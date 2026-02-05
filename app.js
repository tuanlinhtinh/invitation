/* =====================================================
   CONFIG
===================================================== */

const MODEL_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const KNOWN_USERS = [
  { label: "kiet", dir: "kiet", samples: 3 },
  { label: "sonji", dir: "sonji", samples: 2 }
];

// Face match threshold
// 0.45 = strict, 0.6 = loose
const MATCH_THRESHOLD = 0.5;

// Interval (ms) giữa các lần detect
const DETECT_INTERVAL = 600;


/* =====================================================
   DOM
===================================================== */

const video = document.getElementById("video");
const startBtn = document.getElementById("start");
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");


/* =====================================================
   MODEL LOADING
===================================================== */

async function loadModels() {
  statusEl.innerText = "Loading face models…";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
}


/* =====================================================
   CAMERA
===================================================== */

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Camera not supported");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 720 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = stream;

  return new Promise(resolve => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}


/* =====================================================
   LOAD KNOWN FACES
===================================================== */

async function loadKnownFaces() {
  statusEl.innerText = "Preparing known faces…";

  const labeledDescriptors = [];

  for (const user of KNOWN_USERS) {
    const descriptors = [];

    for (let i = 1; i <= user.samples; i++) {
      const imgUrl = `/faces/${user.dir}/${i}.jpg`;

      try {
        const img = await faceapi.fetchImage(imgUrl);

        const detection = await faceapi
          .detectSingleFace(
            img,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5
            })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          descriptors.push(detection.descriptor);
        } else {
          console.warn(`No face found: ${imgUrl}`);
        }
      } catch (err) {
        console.error(`Failed loading ${imgUrl}`, err);
      }
    }

    if (descriptors.length > 0) {
      labeledDescriptors.push(
        new faceapi.LabeledFaceDescriptors(user.label, descriptors)
      );
    } else {
      console.warn(`No valid descriptors for ${user.label}`);
    }
  }

  return labeledDescriptors;
}


/* =====================================================
   FACE RECOGNITION LOOP
===================================================== */

function startRecognition(faceMatcher) {
  statusEl.innerText = "Looking for your face…";

  let locked = false;

  const timer = setInterval(async () => {
    if (locked) return;

    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 224,
          scoreThreshold: 0.5
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return;

    const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

    if (bestMatch.label !== "unknown") {
      locked = true;

      nameEl.innerText = `Welcome, ${bestMatch.label}`;
      statusEl.innerText = "Recognized";

      startBtn.style.display = "none";
      clearInterval(timer);
    }
  }, DETECT_INTERVAL);
}


/* =====================================================
   BOOTSTRAP
===================================================== */

startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    statusEl.innerText = "Initializing…";

    // 1. Load models
    await loadModels();

    // 2. Start camera
    await startCamera();

    // 3. Load known faces
    const labeledFaces = await loadKnownFaces();

    if (labeledFaces.length === 0) {
      throw new Error("No valid face data");
    }

    // 4. Create matcher
    const matcher = new faceapi.FaceMatcher(
      labeledFaces,
      MATCH_THRESHOLD
    );

    // 5. Start recognition loop
    startRecognition(matcher);

  } catch (err) {
    console.error(err);
    statusEl.innerText = `${err.name}: ${err.message}`;
    startBtn.disabled = false;
  }
});
