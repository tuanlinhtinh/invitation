/* =====================================================
   CONFIG
===================================================== */

const MODEL_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const KNOWN_USERS = [
  { label: "linh", dir: "linh", samples: 2 },
  { label: "minh", dir: "minh", samples: 2 },
  { label: "sonji", dir: "sonji", samples: 2 },
  { label: "kiet", dir: "kiet", samples: 2 }
];

const MATCH_THRESHOLD = 0.5;
const DETECT_INTERVAL = 600;

/* =========================
   DETECTOR OPTIONS
========================= */

// 🔥 camera: nhanh & ổn định
const VIDEO_DETECT_OPTIONS =
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.5
  });

// 🔥 image: dễ detect hơn
const IMAGE_DETECT_OPTIONS =
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.3
  });


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
  statusEl.innerText = "Loading AI models…";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
}


/* =====================================================
   CAMERA
===================================================== */

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
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
   LOAD KNOWN FACES – FAIL SAFE
===================================================== */

async function loadKnownFaces() {
  statusEl.innerText = "Preparing face data…";

  const labeledDescriptors = [];

  for (const user of KNOWN_USERS) {
    const descriptors = [];

    for (let i = 1; i <= user.samples; i++) {
      const imgUrl = `/faces/${user.dir}/${i}.jpg`;
      console.log("Loading face:", imgUrl);

      try {
        const img = await faceapi.fetchImage(imgUrl);

        const detection = await faceapi
          .detectSingleFace(img, IMAGE_DETECT_OPTIONS)
          .withFaceDescriptor();

        if (detection?.descriptor) {
          console.log("Face OK:", imgUrl);
          descriptors.push(detection.descriptor);
        } else {
          console.warn("NO FACE FOUND:", imgUrl);
        }
      } catch (err) {
        console.warn("FAILED LOAD:", imgUrl);
      }
    }

    if (descriptors.length > 0) {
      labeledDescriptors.push(
        new faceapi.LabeledFaceDescriptors(
          user.label,
          descriptors
        )
      );
    } else {
      console.warn(`No valid face data for ${user.label}`);
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
    if (video.paused || video.ended) return;

    const detection = await faceapi
      .detectSingleFace(video, VIDEO_DETECT_OPTIONS)
      .withFaceDescriptor();

    if (!detection) return;

    const bestMatch =
      faceMatcher.findBestMatch(detection.descriptor);

    if (bestMatch.label !== "unknown") {
      locked = true;

      nameEl.innerText = bestMatch.label;
      nameEl.classList.add("show");

      statusEl.innerText = "Recognized";
      startBtn.style.display = "none";

      clearInterval(timer);
    }
  }, DETECT_INTERVAL);
}


/* =====================================================
   BOOTSTRAP – FAIL SAFE
===================================================== */

startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    statusEl.innerText = "Initializing…";

    await Promise.all([
      loadModels(),
      startCamera()
    ]);

    const labeledFaces = await loadKnownFaces();

    // 🔥 FAIL SAFE – không crash
    if (labeledFaces.length === 0) {
      statusEl.innerText = "Face data unavailable";
      console.warn("No known faces loaded");
      return;
    }

    const matcher =
      new faceapi.FaceMatcher(
        labeledFaces,
        MATCH_THRESHOLD
      );

    startRecognition(matcher);

  } catch (err) {
    console.error(err);
    statusEl.innerText = err.message;
    startBtn.disabled = false;
  }
});
