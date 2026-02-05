/* =====================================================
   CONFIG – OPTIMIZED
===================================================== */

const MODEL_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const KNOWN_USERS = [
  { label: "kiet", dir: "kiet", samples: 3 },
  { label: "linh", dir: "linh", samples: 2 },
  { label: "minh", dir: "minh", samples: 2 },
  { label: "sonji", dir: "sonji", samples: 2 }
];

// 0.45 = strict, 0.6 = loose
const MATCH_THRESHOLD = 0.5;

// Detection interval (ms)
const DETECT_INTERVAL = 600;

// TinyFaceDetector optimized
const DETECTOR_OPTIONS =
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,          // 🔥 faster ~30%
    scoreThreshold: 0.5
  });


/* =====================================================
   DOM
===================================================== */

const video = document.getElementById("video");
const startBtn = document.getElementById("start");
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");


/* =====================================================
   MODEL LOADING – MINIMAL
===================================================== */

async function loadModels() {
  statusEl.innerText = "Loading AI models…";

  // 🔥 only required models
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
}


/* =====================================================
   CAMERA – FAST START
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
   LOAD KNOWN FACE DESCRIPTORS
===================================================== */

async function loadKnownFaces() {
  statusEl.innerText = "Preparing face data…";

  const labeledDescriptors = [];

  for (const user of KNOWN_USERS) {
    const descriptors = [];

    for (let i = 1; i <= user.samples; i++) {
      const imgUrl = `/faces/${user.dir}/${i}.jpg`;

      try {
        const img = await faceapi.fetchImage(imgUrl);

        const detection = await faceapi
          .detectSingleFace(img, DETECTOR_OPTIONS)
          .withFaceDescriptor();

        if (detection?.descriptor) {
          descriptors.push(detection.descriptor);
        } else {
          console.warn("No face:", imgUrl);
        }
      } catch (err) {
        console.warn("Load failed:", imgUrl);
      }
    }

    if (descriptors.length > 0) {
      labeledDescriptors.push(
        new faceapi.LabeledFaceDescriptors(
          user.label,
          descriptors
        )
      );
    }
  }

  return labeledDescriptors;
}


/* =====================================================
   FACE RECOGNITION LOOP – STABLE
===================================================== */

function startRecognition(faceMatcher) {
  statusEl.innerText = "Looking for your face…";

  let locked = false;

  const timer = setInterval(async () => {
    if (locked) return;
    if (video.paused || video.ended) return;

    const detection = await faceapi
      .detectSingleFace(video, DETECTOR_OPTIONS)
      .withFaceDescriptor();

    if (!detection) return;

    const bestMatch =
      faceMatcher.findBestMatch(detection.descriptor);

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
   BOOTSTRAP – PARALLEL INIT
===================================================== */

startBtn.addEventListener("click", async () => {
  try {
    startBtn.disabled = true;
    statusEl.innerText = "Initializing…";

    // 🔥 Parallel = faster perceived load
    await Promise.all([
      loadModels(),
      startCamera()
    ]);

    const labeledFaces = await loadKnownFaces();

    if (labeledFaces.length === 0) {
      throw new Error("No face data available");
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
