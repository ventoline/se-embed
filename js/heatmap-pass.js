import {
  AddEquation,
  Color,
  CustomBlending,
  DataTexture,
  DepthTexture,
  DepthStencilFormat,
  DstAlphaFactor,
  DstColorFactor,
  HalfFloatType,
  MeshNormalMaterial,
  NearestFilter,
  NoBlending,
  SubtractiveBlending,
  AdditiveBlending,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  UniformsUtils,
  UnsignedByteType,
  UnsignedInt248Type,
  WebGLRenderTarget,
  ZeroFactor,
} from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import HMPassShader from "./heatmap-pp-shader.js";

import { CopyShader } from "three/addons/shaders/CopyShader.js";

class HeatmapPass extends Pass {
  constructor(scene, camera, width, height, parameters, aoParameters) {
    super();

    this.width = width !== undefined ? width : 512;
    this.height = height !== undefined ? height : 512;
    this.clear = false; //true;
    this.camera = camera;
    this.scene = scene;
    this.output = 0;
    this._renderGBuffer = true;
    this._visibilityCache = new Map();
    //this.blendIntensity = 1;

    //HEATMAP SHADER
    this.heatmapShader = new HMPassShader().HMShader;

    this.gtaoRenderTarget = new WebGLRenderTarget(this.width, this.height, {
      type: HalfFloatType,
    });

    this.heatmapMaterial = new ShaderMaterial({
      name: "heatmapMaterial",
      transparent: true,
      defines: Object.assign({}, this.heatmapShader.defines),
      uniforms: UniformsUtils.clone(this.heatmapShader.uniforms), // pass uniform point array
      vertexShader: this.heatmapShader.vertexShader,
      fragmentShader: this.heatmapShader.fragmentShader,
      // blending: NoBlending, //TODO set ble3nding
      depthTest: false,
      depthWrite: false,
    });
    this.heatmapMaterial.defines.PERSPECTIVE_CAMERA = this.camera
      .isPerspectiveCamera
      ? 1
      : 0;
    //  this.heatmapMaterial.uniforms.resolution.value.set(this.width, this.height);
    this.heatmapMaterial.uniforms.cameraNear.value = this.camera.near;
    this.heatmapMaterial.uniforms.cameraFar.value = this.camera.far;

    this.normalMaterial = new MeshNormalMaterial();
    // this.normalMaterial.blending = NoBlending;//TODO set ble3nding

    this.copyMaterial = new ShaderMaterial({
      name: "copyMat",
      uniforms: UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      depthWrite: false,
      blendSrc: DstColorFactor,
      blendDst: ZeroFactor,
      blendEquation: AddEquation,
      blendSrcAlpha: DstAlphaFactor,
      blendDstAlpha: ZeroFactor,
      blendEquationAlpha: AddEquation,
    });

    this.fsQuad = new FullScreenQuad(null);

    this.originalClearColor = new Color();

    this.setGBuffer(
      parameters ? parameters.depthTexture : undefined,
      parameters ? parameters.normalTexture : undefined
    );

    if (aoParameters !== undefined) {
      this.updateGtaoMaterial(aoParameters);
    }
  }

  dispose() {
    this.gtaoNoiseTexture.dispose();
    this.normalRenderTarget.dispose();
    this.gtaoRenderTarget.dispose();

    this.depthRenderMaterial.dispose();
    this.fsQuad.dispose();
  }

  setGBuffer(depthTexture, normalTexture) {
    if (depthTexture !== undefined) {
      this.depthTexture = depthTexture;
      this.normalTexture = normalTexture;
      this._renderGBuffer = false;
    } else {
      this.depthTexture = new DepthTexture();
      this.depthTexture.format = DepthStencilFormat;
      this.depthTexture.type = UnsignedInt248Type;
      this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        type: HalfFloatType,
        depthTexture: this.depthTexture,
      });
      this.normalTexture = this.normalRenderTarget.texture;
      this._renderGBuffer = true;
    }

    const normalVectorType = this.normalTexture ? 1 : 0;
    const depthValueSource =
      this.depthTexture === this.normalTexture ? "w" : "x";

    this.heatmapMaterial.defines.NORMAL_VECTOR_TYPE = normalVectorType;
    this.heatmapMaterial.defines.DEPTH_SWIZZLING = depthValueSource;
    this.heatmapMaterial.uniforms.tNormal.value = this.normalTexture;
    this.heatmapMaterial.uniforms.tDepth.value = this.depthTexture;
  }

  updateCameraMatrix(camera) {
    if (camera !== undefined) {
      this.heatmapMaterial.uniforms.cameraProjectionMatrix.value =
        camera.projectionMatrix;
      this.heatmapMaterial.uniforms.cameraWorldMatrix.value =
        camera.matrixWorld;
      this.heatmapMaterial.uniforms.cameraWorldPos.value = camera.position;
    }
  }

  render(renderer, writeBuffer, readBuffer /*, deltaTime, maskActive */) {
    if (this._renderGBuffer) {
      this.renderOverride(renderer, this.normalRenderTarget);
    }

    // render
    this.heatmapMaterial.uniforms.cameraNear.value = this.camera.near;
    this.heatmapMaterial.uniforms.cameraFar.value = this.camera.far;
    this.heatmapMaterial.uniforms.cameraProjectionMatrix.value.copy(
      this.camera.projectionMatrix
    );

    this.heatmapMaterial.uniforms.cameraWorldMatrix.value.copy(
      this.camera.matrixWorld
    );

    this.renderPass(
      renderer,
      this.heatmapMaterial,
      this.renderToScreen ? null : writeBuffer, //  this.gtaoRenderTarget,
      0x00000ff,
      1.0
    );
  }

  renderPass(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {
    renderer.setRenderTarget(renderTarget);

    // setup pass state
    renderer.autoClear = false;
    if (clearColor !== undefined && clearColor !== null) {
      // renderer.clear();
    }

    this.fsQuad.material = passMaterial;
    this.fsQuad.render(renderer);
  }

  renderOverride(renderer, renderTarget) {
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  setSize(width, height) {
    this.width = width;
    this.height = height;

    this.gtaoRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);

    this.heatmapMaterial.uniforms.resolution.value.set(width, height);
    this.heatmapMaterial.uniforms.cameraProjectionMatrix.value.copy(
      this.camera.projectionMatrix
    );
  }
}

export { HeatmapPass };
