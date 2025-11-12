console.log("TEst Video.js has loaded and is running");
// --- 1. CONFIGURATION ---

const firebaseConfig = {
  apiKey: "AIzaSyBdvLfAuVGVi_PZcujBkbuQV3CI6ZGwX_0",
  authDomain: "design-thinking-project-29898.firebaseapp.com",
  projectId: "design-thinking-project-29898",
  storageBucket: "design-thinking-project-29898.firebasestorage.app",
  messagingSenderId: "251200050785",
  appId: "1:251200050785:web:862e4876623fb850b87c20"
};

const MY_RENDER_URL = 'cuvlib-backend.onrender.com';

// --- 2. INITIALIZATION ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log("Firebase DB object:", db);

// Get DOM elements (Video)
const videoGrid = document.getElementById('video-grid');
const localVideoContainer = document.getElementById('local-video-container');
const localVideo = document.getElementById('local-video');
const localAvatar = document.getElementById('local-avatar');
const micBtn = document.getElementById('micBtn1');
const camBtn = document.getElementById('camBtn1');

// Get DOM elements (Whiteboard)
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clear-whiteboard-btn');
const colorPicker = document.getElementById('color-picker');
const whiteboardContainer = document.getElementById('whiteboard-container');
const fullscreenBtn = document.getElementById('fullscreen-whiteboard-btn');

// Get Room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room');
console.log("Checkpoint 1: My Room ID is:", ROOM_ID);
if (!ROOM_ID) {
  alert('No room ID found! Please join with a URL like ?room=my-room-name');
}

// Firebase References
const roomRef = db.collection('rooms').doc(ROOM_ID);
const usersRef = roomRef.collection('users');
const whiteboardRef = roomRef.collection('whiteboard');

// PeerJS Setup
const myGeneratedId = 'user-' + Math.random().toString(36).substring(2, 9);
console.log("Checkpoint 2.5: Generated our own ID:", myGeneratedId);

const peer = new Peer(myGeneratedId, {
  host: MY_RENDER_URL,
  port: 443,
  path: '/', // Use the root path
  secure: true
});

// Global state variables
let myStream;
let myPeerId;
const connectedPeers = {};

// --- 3. PEERJS EVENT LISTENERS ---
// We attach these listeners immediately to prevent race conditions

peer.on('open', (id) => {
  console.log("Checkpoint 3: Peer connection is OPEN. My ID is:", id);
  myPeerId = id;
  // If the stream is already ready, join the room.
  // Otherwise, getUserMedia will call joinRoom later.
  if (myStream) {
    joinRoom(id);
  }
});

peer.on('error', (err) => {
  console.error("PEERJS ERROR:", err);
});

// Listen for incoming calls
peer.on('call', (call) => {
  console.log('Answering call from', call.peer);
  call.answer(myStream); // Answer with our stream

  // When we get their stream, add it to the page
  call.on('stream', (friendStream) => {
    addRemoteVideoStream(friendStream, call.peer);
  });

  // Store the call object to close it later
  connectedPeers[call.peer] = call;
});


// --- 4. CORE LOGIC: GET USER MEDIA & JOIN ---

navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {
  console.log("Checkpoint 2: Got user media (camera/mic)");
  myStream = stream;
  addMyVideoStream(stream);
  setupLocalControls(); // Setup buttons now that we have a stream

  // Check if the peer connection is *already* open.
  // If it is, we can join the room.
  if (myPeerId) {
    joinRoom(myPeerId);
  }

}).catch(err => {
  console.error('Failed to get media', err);
  alert('Could not access camera or microphone.');
});

// --- 5. FIREBASE & PEER FUNCTIONS ---

function joinRoom(peerId) {
  console.log("Checkpoint 4: Calling joinRoom(). Writing to Firebase...");
  usersRef.doc(peerId).set({
    peerId: peerId,
    name: 'New User'
  });

  // Now that we've joined, start watching for others
  watchForNewUsers(peerId);
  watchForUserLeft(peerId);
}

function watchForNewUsers(myId) {
  usersRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const newPeerId = change.doc.data().peerId;
        if (newPeerId !== myId && !connectedPeers[newPeerId]) { // Check if not already connected
          console.log('New user joined:', newPeerId);
          connectToNewUser(newPeerId, myStream);
        }
      }
    });
  });
}

function connectToNewUser(friendPeerId, stream) {
  console.log(`Calling new user: ${friendPeerId}`);
  const call = peer.call(friendPeerId, stream);

  call.on('stream', (friendStream) => {
    addRemoteVideoStream(friendStream, friendPeerId);
  });

  // Store the call object
  connectedPeers[friendPeerId] = call;
}

function watchForUserLeft(myId) {
  usersRef.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'removed') {
        const leftPeerId = change.doc.data().peerId;
        if (leftPeerId !== myId) {
          console.log('User left:', leftPeerId);
          document.getElementById(leftPeerId)?.remove();
          if (connectedPeers[leftPeerId]) {
            connectedPeers[leftPeerId].close();
            delete connectedPeers[leftPeerId];
          }
        }
      }
    });
  });
}

// --- 6. DOM MANIPULATION FUNCTIONS ---

function addMyVideoStream(stream) {
  localVideo.srcObject = stream;
  localVideo.style.display = 'block';
  localAvatar.style.display = 'none';
}

function addRemoteVideoStream(stream, peerId) {
  if (document.getElementById(peerId)) return;

  const videoBox = document.createElement('div');
  videoBox.className = 'video-box h-64 flex flex-col items-center justify-center relative';
  videoBox.id = peerId;

  const randomGender = Math.random() > 0.5 ? 'men' : 'women';
  const randomId = Math.floor(Math.random() * 80);
  const avatarSrc = `https://randomuser.me/api/portraits/${randomGender}/${randomId}.jpg`;

  videoBox.innerHTML = `
    <video autoplay playsinline class="w-full h-full object-cover" style="display: none;"></video>
    <img src="${avatarSrc}" alt="User" class="video-avatar">
    <span class="video-name">User ${peerId.substring(0, 4)}</span>
  `;
  videoGrid.append(videoBox);

  const remoteVideo = videoBox.querySelector('video');
  const remoteAvatar = videoBox.querySelector('img');
  
  remoteVideo.srcObject = stream;
  remoteVideo.play();
  remoteVideo.style.display = 'block';
  remoteAvatar.style.display = 'none';
  
  stream.getVideoTracks()[0].onended = () => {
    remoteVideo.style.display = 'none';
    remoteAvatar.style.display = 'block';
  };
}

// --- 7. LOCAL CONTROLS ---

function setupLocalControls() {
  let micOn = true;
  let camOn = true;

  micBtn.addEventListener('click', () => {
    micOn = !micOn;
    myStream.getAudioTracks()[0].enabled = micOn;
    micBtn.innerHTML = micOn
      ? '<i data-feather="mic" class="w-5 h-5"></i>'
      : '<i data-feather="mic-off" class="w-5 h-5 text-red-500"></i>';
    feather.replace(); // Re-render icons
  });

  camBtn.addEventListener('click', () => {
    camOn = !camOn;
    myStream.getVideoTracks()[0].enabled = camOn;
    camBtn.innerHTML = camOn
      ? '<i data-feather="video" class="w-5 h-5"></i>'
      : '<i data-feather="video-off" class="w-5 h-5 text-red-500"></i>';
    feather.replace(); // Re-render icons

    localVideo.style.display = camOn ? 'block' : 'none';
    localAvatar.style.display = camOn ? 'none' : 'block';
  });
}

// --- 8. LEAVE FUNCTION ---

window.handleLeave = () => {
  if (myPeerId) {
    usersRef.doc(myPeerId).delete();
  }
  if (myStream) {
    myStream.getTracks().forEach(track => track.stop());
  }
  for (const peerId in connectedPeers) {
    connectedPeers[peerId].close();
  }
  peer.destroy();
};

// Add the cleanup event for tab close/refresh
window.onbeforeunload = window.handleLeave;

// --- 9. WHITEBOARD LOGIC (COMPLETE & CORRECTED) ---

// --- 9.1. Settings ---
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentStroke = [];

// --- 9.2. Helper Function: Draw a Line ---
function drawLine(x0, y0, x1, y1, color) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.closePath();
}

// --- 9.3. Helper Function: Load All History ---
function loadWhiteboardHistory() {
  console.log("Loading whiteboard history...");
  whiteboardRef.orderBy('timestamp', 'asc').get().then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      if (data.type === 'stroke') {
        const points = data.points;
        const color = data.color;
        for (let i = 1; i < points.length; i++) {
          drawLine(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color);
        }
      }
    });
  });
}

// --- 9.4. Helper Function: Resize Canvas (The Accuracy Fix) ---
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  loadWhiteboardHistory(); // Reload history after resizing
}

// --- 9.5. Local Drawing Event Listeners ---
function startDrawing(e) {
  isDrawing = true;
  [lastX, lastY] = [e.offsetX, e.offsetY];
  currentStroke = [{ x: lastX, y: lastY }];
}

function draw(e) {
  if (!isDrawing) return;
  const newX = e.offsetX;
  const newY = e.offsetY;
  drawLine(lastX, lastY, newX, newY, colorPicker.value);
  currentStroke.push({ x: newX, y: newY });
  [lastX, lastY] = [newX, newY];
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentStroke.length > 1) {
    whiteboardRef.add({
      type: 'stroke',
      senderId: myPeerId,
      color: colorPicker.value,
      points: currentStroke
    });
  }
  currentStroke = [];
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// --- 9.6. Button & Resize Event Listeners ---
clearBtn.addEventListener('click', () => {
  whiteboardRef.add({ type: 'clear', senderId: myPeerId });
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    whiteboardContainer.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);

// --- 9.7. Firebase Timestamp Wrapper ---
const originalAdd = whiteboardRef.add;
whiteboardRef.add = function(data) {
  return originalAdd.call(this, {
    ...data,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
};

// --- 9.8. Real-time Sync (The Streaming Part) ---
whiteboardRef.orderBy('timestamp', 'asc').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      // Don't draw docs that are still being written locally
      if (change.doc.metadata.hasPendingWrites) {
        return;
      }

      const data = change.doc.data();

      if (data.type === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      if (data.type === 'stroke' && data.senderId !== myPeerId) {
        const points = data.points;
        const color = data.color;
        for (let i = 1; i < points.length; i++) {
          drawLine(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, color);
        }
      }
    }
  });
});

// --- 9.9. Initial Call ---
// Set the initial correct size of the canvas and load the history.
resizeCanvas();