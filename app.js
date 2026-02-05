/* =====================================================
   CONFIG
===================================================== */

const MODEL_URL =
  "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights";

const KNOWN_USERS = [
  { label: "linh", dir: "linh", samples: 2 },
  { label: "kiet", dir: "kiet", samples: 2 },
  { label: "sonji", dir: "sonji", samples: 2 },
  { label: "dung", dir: "dung", samples: 2 },
  { label: "minh", dir: "minh", samples: 2 }
];

const MATCH_THRESHOLD = 0.5;
const DETECT_INTERVAL = 600;

/* =========================
   DETECTOR OPTIONS
========================= */

const VIDEO_DETECT_OPTIONS =
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 160,
    scoreThreshold: 0.5
  });

const IMAGE_DETECT_OPTIONS =
  new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.3
  });


/* =====================================================
   DOM
===================================================== */

const video = document.getElementById("video");
const statusEl = document.getElementById("status");
const nameEl = document.getElementById("name");


/* =====================================================
   FACE-API READINESS (🔥 FIX CỐT LÕI)
===================================================== */

async function waitForFaceApiReady(timeout = 3000) {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (
        faceapi?.nets?.tinyFaceDetector?.params &&
        faceapi?.nets?.faceRecognitionNet?.params
      ) {
        resolve();
      } else if (performance.now() - start > timeout) {
        reject(new Error("FaceAPI not ready"));
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  });
}


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
  statusEl.innerText = "Requesting camera…";

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
   LOAD KNOWN FACES (FAIL SAFE)
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
          .detectSingleFace(img, IMAGE_DETECT_OPTIONS)
          .withFaceDescriptor();

        if (detection?.descriptor) {
          descriptors.push(detection.descriptor);
        }
      } catch (err) {
        console.warn("Face load fail:", imgUrl);
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
   FACE RECOGNITION LOOP
===================================================== */

function startRecognition(faceMatcher) {
  statusEl.innerText = "Looking for your face…";

  let locked = false;

  const timer = setInterval(async () => {
    if (locked || video.paused || video.ended) return;

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

      statusEl.innerText = "Welcome";
      clearInterval(timer);
    }
  }, DETECT_INTERVAL);
}


/* =====================================================
   AUTO BOOTSTRAP (NO BUTTON)
===================================================== */

window.addEventListener("load", async () => {
  try {
    await Promise.all([
      loadModels(),
      startCamera()
    ]);

    // 🔥 FIX RACE CONDITION
    await waitForFaceApiReady();

    const labeledFaces = await loadKnownFaces();

    if (labeledFaces.length === 0) {
      statusEl.innerText = "Face data unavailable";
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
  }
});
