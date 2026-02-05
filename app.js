const KNOWN_USERS = [
  { label: "Kiet Nguyen", dir: "kietnguyen", samples: 3 },
  { label: "Sonji", dir: "sonji", samples: 3 }
];

async function loadModels() {
  const URL = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights";

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(URL),
  ]);
}


async function loadKnownFaces() {
  return Promise.all(
    KNOWN_USERS.map(async user => {
      const descriptors = [];

      for (let i = 1; i <= user.samples; i++) {
        const img = await faceapi.fetchImage(
          `/faces/${user.dir}/${i}.jpg`
        );

        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          descriptors.push(detection.descriptor);
        }
      }

      return new faceapi.LabeledFaceDescriptors(
        user.label,
        descriptors
      );
    })
  );
}

const video = document.getElementById("video");

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("getUserMedia not supported");
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


async function startRecognition(faceMatcher) {
  const status = document.getElementById("status");
  const nameEl = document.getElementById("viewer-name");

  status.innerText = "Looking for your face…";

  let locked = false;

  setInterval(async () => {
    if (locked) return;

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return;

    const result = faceMatcher.findBestMatch(detection.descriptor);

    if (result.label !== "unknown") {
      locked = true;

      status.innerText = "Recognized";
      nameEl.innerText = `Welcome, ${result.label}`;
    }
  }, 600);
}

(async () => {
  try {
    await loadModels();
    document.getElementById("status").innerText = "Models loaded";

    await startCamera();

    const labeledFaces = await loadKnownFaces();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaces, 0.5);

    startRecognition(faceMatcher);
  } catch (e) {
    document.getElementById("status").innerText =
      "Camera permission required";
    console.error(e);
  }
})();
