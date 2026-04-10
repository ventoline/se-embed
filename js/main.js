import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

//import heatmap  pass
import { HeatmapPass } from "./heatmap-pass.js";

import HMPassShader from "./heatmap-pp-shader.js"; //TODO fix the export class

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { heatmapShader } from "./heatmap-shader.js"; //for dynos

import Stats from "Stats";

const apiUrl = "https://api.c3ddev.com/v0"; // 'cognitive3d.com'

//TODO pass vars through host page
var projectID = "382"; //for testing
var sceneID = "36b3fa71-bdb2-4da7-a313-d40279da90ff"; // for testing
var sessionID = "1733429399_2c357ef5f471268315c1ce5c1d06fc0b"; // for testing
var apiKey = "APIKEY:ORGANIZATION v7e2tkMcqPq8P2DP4h5uYSx7lvjvzrEn"; // for testing // Authorization: "APIKEY:ORGANIZATION Kg9l8YQYJpB7NrUkYrIYC4Nquurl0ciw",
var currentSession;
let sceneInit = false;

var sessionGaze = [];

//HTML canvas three____________________________________

let canvas = document.getElementById("canvas");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  canvas.getBoundingClientRect().width / canvas.getBoundingClientRect().height,
  0.1,
  1000
);
camera.far = 20000;
camera.updateProjectionMatrix();
scene.add(camera);
camera.position.y = 1; // at human height

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true,
});

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
renderPass.needsSwap = true;
composer.addPass(renderPass);

//Heatmap
const heatmapPass = new HeatmapPass(
  scene,
  camera,
  canvas.getBoundingClientRect().width,
  canvas.getBoundingClientRect().height
);

composer.addPass(heatmapPass);
const outputPass = new OutputPass();
composer.addPass(outputPass);

//ANIMATIONS
var mixer;
var controls;

//STATS
const statsGUI = Stats();
statsGUI.dom.style.position = "absolute";
statsGUI.dom.style.inset = null; //"99vh 5px";
statsGUI.dom.style.bottom = "0";
document.body.appendChild(statsGUI.dom);

//toggle stats
addEventListener("keydown", (event) => {
  //I
  if (event.code === "KeyI") {
    statsGUI.dom.style.display =
      statsGUI.dom.style.display === "none" ? "block" : "none";
  }
});

//GET PARAMS

//get account and session params
const getParams = () => {
  var url = window.location.search.substring(1); //get rid of "?" in querystring

  //ignore when testing
  if (!window.location.hostname === "127.0.0.1") {
    var qArray = url.split("&"); //get key-value pairs
    for (var i = 0; i < qArray.length; i++) {
      var pArr = qArray[i].split("="); //split key and value
      if (pArr[0] === "projectId") {
        projectID = pArr[1];
      }
      if (pArr[0] === "sceneId") {
        sceneID = pArr[1];
      }
      if (pArr[0] === "sessionId") {
        sessionID = pArr[1];
      }
      if (pArr[0] === "apiKey") {
        apiKey = decodeURI(pArr[1]);
      }
    }
  }
};

// DATA_________________________________

//get session data
const loadSessionData = (sceneID) => {
  //session query
  const url = `${apiUrl}/datasets/sessions/multiQueries`;
  const header = {
    Authorization: apiKey, // withCredentials: true,
    "Content-Type": "application/json",
  };

  let body = JSON.stringify({
    projectId: parseInt(projectID), //this.sceneStore.scenes.projectId,
    sceneId: sceneID.sceneId,
    versionId: sceneID.id, // this.sceneStore.activeScene$.value.id,
    sdkSessionIds: [sessionID.toString()], //this.sceneStore.sessionsSelection,
  });
  const reqOptions = {
    method: "POST",
    headers: header,
    body: body,
    withCredentials: true,
  };

  fetch(url, reqOptions)
    .then((response) => {
      if (!response.ok) {
        console.error("error loading session", response.code);
      }
      return response.json();
    })
    .then((response) => {
      // console.log(Object.keys(response)[0], response[sessionID.toString()]);
      currentSession = response[sessionID.toString()];
    });

  //set animations files
};

const loadGazeData = (sceneID) => {
  const url = `${apiUrl}/versions/${sceneID.id}/gaze/${encodeURI(sessionID)}`;

  const header = {
    Authorization: apiKey,
  };
  let requestOptions = {
    method: "GET",
    headers: header,
    // redirect: "follow",
  };
  fetch(url, requestOptions)
    .then((response) => {
      return response.json();
    })
    .then((response) => {
      let data = response.data;

      // trim time
      data.forEach((p) => {
        p.time -= response.timestamp;
        p.p[0] *= 1 / sceneID.scale;
        p.p[1] *= 1 / sceneID.scale;
        p.p[2] *= 1 / sceneID.scale;
        if (!!p.f) {
          p.f[0] *= 1 / sceneID.scale;
          p.f[1] *= 1 / sceneID.scale;
          p.f[2] *= 1 / sceneID.scale;
        }
        if (!!p.g) {
          p.g[0] *= 1 / sceneID.scale;
          p.g[1] *= 1 / sceneID.scale;
          p.g[2] *= 1 / sceneID.scale;
        }
      });

      // set camera position to look at first gaze
      let gazeData = data.find((p) => p.g);
      camera.lookAt(gazeData.g[0], gazeData.g[1], gazeData.g[2]);

      //separate  dynos gaze from the scene gaze
      let dynoGaze = [];
      let sceneGaze = [];
      data.forEach((p) => {
        if (!!p.o) dynoGaze.push(p);
        else {
          sceneGaze.push(p);
        }
      });

      sessionGaze = sceneGaze;

      // make path
      const points = [];
      data.forEach((point) => {
        points.push(new THREE.Vector3(point.p[0], point.p[1], point.p[2]));
      });

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x720dd1,
        linewidth: 15,
      });
      const pathWire = new THREE.Line(geometry, material);
      scene.add(pathWire);

      if (!!data && !!currentSession) buildHMDAnimation(data);
    });
};

//get scene ID and version no
const loadScenes = () => {
  const scenesURL = `${apiUrl}/scenes/${sceneID}`;
  const header = {
    Authorization: apiKey,
  };
  let requestOptions = {
    method: "GET",
    headers: header,
    // redirect: "follow",
  };

  fetch(scenesURL, requestOptions)
    .then((response) => {
      let res = response;

      if (!response.ok) {
        console.warn("scene response not ok", res);

        let errMsg = document.getElementsByClassName("over-msg")[0];
        errMsg.innerHTML =
          "<p>" + res.status + " " + res.type + " " + res.statusText + "</p>";
      }

      return response.json();
    })
    .then((response) => {
      //get recent scene ID
      let sceneVersionID = response.versions.sort(
        (a, b) => a.versionNumber - b.versionNumber
      );
      let recentSceneID = sceneVersionID.pop();

      //get session data
      loadSessionData(recentSceneID);
      loadGazeData(recentSceneID);

      //3d scene
      fetchGLTFScene(recentSceneID);
    });
};

//3D_________________________________________
// GLTF scene
const fetchGLTFScene = (sceneID) => {
  const url =
    sceneID.isOptimized == true
      ? `${apiUrl}/versions/${sceneID.id}/files/optimized/scene/scene.gltf`
      : `${apiUrl}/versions/${sceneID.id}/files/scene/scene.gltf`;

  const header = {
    Authorization: apiKey,
  };

  //GLTFLoader

  // add draco decoder?

  const gltfLoader = new GLTFLoader();
  gltfLoader.setRequestHeader(header);

  gltfLoader.load(
    url,
    (gltf) => {
      //remove lights
      gltf.scene.traverse((child) => {
        if (child.type === "PointLight" || child.type === "DirectionalLight") {
          child.parent.remove(child);
        }
      });

      //scale scene
      gltf.scene.scale.set(
        1 / sceneID.scale,
        1 / sceneID.scale,
        1 / sceneID.scale
      );
      scene.add(gltf.scene);

      gltf.scene.material = new THREE.MeshPhongMaterial({
        color: "3f7b9d",
        transparent: true,
        opacity: 0.5,
      });

      gltf.scale;
    },
    (xhr) => {},
    (err) => {
      console.error(err);
    }
  );
};

//gaze
const buildHMDAnimation = (data) => {
  let times = [];
  let pos = [];
  let r = [];
  data.forEach((point) => {
    times.push(point.time);
    pos.push(point.p[0]);
    pos.push(point.p[1]);
    pos.push(point.p[2]);
    r.push(point.r[0]);
    r.push(point.r[1]);
    r.push(point.r[2]);
    r.push(point.r[3]);
  });

  //make anim file
  let posTrack = new THREE.VectorKeyframeTrack("cube.position", times, pos);
  let qTrack = new THREE.QuaternionKeyframeTrack("cube.quaternion", times, r);

  let clip = new THREE.AnimationClip("HMD", currentSession.duration / 1000, [
    posTrack,
    qTrack,
  ]);
  // add the file to the camera / HMD
  let cube = scene.getObjectByName("cube");
  cube.animations[0] = clip;
  mixer = new THREE.AnimationMixer(cube);
  mixer.clipAction(clip).play();
  mixer.update(0);
};

//heatmaps

const updateSceneHeatMap = (currentTime) => {
  //create the gazePoints array

  //TODO restrict to 1000
  let gazePoints = [];
  sessionGaze.forEach((p) => {
    if (!!p.g && p.time < currentTime) {
      gazePoints.push(p.g[0]);
      gazePoints.push(p.g[1]);
      gazePoints.push(p.g[2]);
      gazePoints.push(p.time);
    }
  });

  //TODO copy last point and check for dupes in shader
  for (let i = 0; gazePoints.length < 1000; i++) {
    gazePoints.push(0.0001);
  }

  heatmapPass.heatmapMaterial.uniforms.gazePointsLen.value = sessionGaze.length;
  heatmapPass.heatmapMaterial.uniforms.gazePoints.value = gazePoints;
  heatmapPass.heatmapMaterial.uniforms.timing.value = parseFloat(currentTime);
};



//THREEJS

const initThreeScene = () => {
  renderer.setSize(
    canvas.getBoundingClientRect().width,
    canvas.getBoundingClientRect().height
  );
  composer.setSize(
    canvas.getBoundingClientRect().width,
    canvas.getBoundingClientRect().height
  );

  renderer.setClearColor(0x06010d, 1); //TODO Change

  controls = new OrbitControls(camera, renderer.domElement);

  //TEST CUBE
  const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const material = new THREE.MeshStandardMaterial({ color: 0x110fff });
  const cube = new THREE.Mesh(geometry, material);
  cube.name = "cube";
  scene.add(cube);
  //CAMERA
  camera.position.z = 5;

  //LIGHT
  //TODO refine lighting
  const light = new THREE.DirectionalLight(0xffffff, 0.5);
  light.rotateX(0.25);
  scene.add(light);

  function animate() {
    //implement a pause
    requestAnimationFrame(animate);

    controls.update();
    camera.updateMatrix();
    camera.updateProjectionMatrix;
    camera.updateWorldMatrix();
    heatmapPass.updateCameraMatrix(camera);
    statsGUI.update();

    // renderer.render(scene, camera);
    composer.render(scene, camera);
  }

  animate();

  sceneInit = true;
};

const resizeScene = () => {
  let htmlCanvas = document.getElementById("canvas");

  htmlCanvas.width = window.innerWidth;
  htmlCanvas.height = window.innerHeight;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  // renderer.render(scene, camera);
  composer.render(scene, camera);
};

// TIMELINE

const updateTimeline = (e) => {
  let currTime = Math.floor(
    e.currentTarget.value * 0.01 * currentSession.duration * 0.001
  );

  let timer = document.getElementById("timer");
  let timing = (
    e.currentTarget.value *
    0.01 *
    currentSession.duration *
    0.001
  ).toFixed(2);
  timer.innerHTML = timing + "s";

  //update animations : camera and dynos
  mixer.update(currTime);

  /*   //move camera as FPS
  let cube = scene.getObjectByName("cube");
  camera.position.x = cube.position.x;
  camera.position.y = cube.position.y;
  camera.position.z = cube.position.z;
  camera.rotation.x = cube.rotation.x;
  camera.rotation.y = cube.rotation.y;
  camera.rotation.z = cube.rotation.z;
 */

  //update heatmap
  updateSceneHeatMap(timing);
};

var sliderTime = document.getElementById("timeline");

sliderTime.addEventListener("input", updateTimeline);

//WINDOW EVENTS
window.addEventListener(
  "load",
  (event) => {
    if (!sceneInit) {
      // session params
      getParams();
      loadScenes(); //TODO pass param
      initThreeScene();
    }
  },
  { once: true }
);

window.addEventListener("resize", (event) => {
  resizeScene();
});
