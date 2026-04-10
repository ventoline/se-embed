import { DataTexture, Matrix4, RepeatWrapping, Vector2, Vector3 } from "three";

class HMPassShader {
  HMShader = {
    name: "HeatmapPassShader",

    defines: {
      PERSPECTIVE_CAMERA: 1,
      array_len: 1000, // TODO update to gazepoint length
    },

    uniforms: {
      tNormal: { value: null },
      tDepth: { value: null },
      tNoise: { value: null },
      resolution: { value: new Vector2() },
      cameraNear: { value: null },
      cameraFar: { value: null },
      cameraProjectionMatrix: { value: new Matrix4() },
      // cameraProjectionMatrixInverse: { value: new Matrix4() },
      cameraWorldMatrix: { value: new Matrix4() },
      cameraWorldPos: { value: new Vector3() },
      radius: { value: 0.25 },
      distanceExponent: { value: 1 },
      thickness: { value: 1 },
      distanceFallOff: { value: 1 },
      scale: { value: 1 },
      sceneBoxMin: { value: new Vector3(-1, -1, -1) },
      sceneBoxMax: { value: new Vector3(1, 1, 1) },
      //DATA
      timing: { type: "float", value: 0.0 },
      gazePointsLen: { type: "int", value: 0 },
      gazePoints: { /*  type: "v1f", */ value: new Array(1000) },
    },

    vertexShader: `
	   uniform float timing;
		varying vec2 vUv;
		varying vec4 scene0;

		void main() {
			vUv = uv;
            scene0 = vec4(.0, .0, .0, 1.0 );
			vec4 viewPos = viewMatrix * scene0;
		 	gl_Position = vec4( position, 1.0 ); //	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		precision highp float;
	//	precision highp vec3;

		uniform sampler2D tDepth;
		uniform float cameraNear,  cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraWorldMatrix;

			//array length
        uniform float timing;
		uniform  int gazePointsLen;
		uniform  float gazePoints[array_len];
		varying vec2 vUv;
		varying vec4 scene0; //array

		//gradient

		float MAX_DIST = .75;// 1.0;
		float center = .2;
		int stopsNb = 3;
        float stops[3] =  float[3](0.,.25, 1.); // gradient linear from the center to the edge, can be weighted
         vec3 palette[3] =  vec3[3]( 
		 vec3(.5,.7,0.0), //NEON YELLOW
		 vec3(.7,0.,1.),// MAGENTA RED
		 vec3(0.,0.,1.0)//BLUE
);

		#include <packing>

        //_____________WORLD POSITION

        vec3 getWorldPosition(vec2 uv){
          float z=texture2D(tDepth,uv).r*2.-1.;
          vec4 clipPos=vec4(uv*2.-1.,z,1.);
          vec4 viewPos= inverse(cameraProjectionMatrix)*clipPos; 
          viewPos/=viewPos.w;
          return (cameraWorldMatrix*viewPos).xyz;
        }
      
		//_____________DEPTH
		
  		 float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				 return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}


		//_____________GRADIENT

	vec4	applyGradient(float heat){
// calculate color stops
float weightedStops[3] = stops;

for (int i = 0; i< stopsNb; i++){
weightedStops[i] = mix(center, 1.0, stops[i]);
}
 
//mix colors
int idx = 0;
 // find the adjacent colors
for (int i = 0; i< stopsNb; i++){
if(heat>  weightedStops[i])
{ idx = i; }
}
float weight =   (heat  - weightedStops[idx] ) /(weightedStops[idx+1] - weightedStops[idx] ); //remap??

vec3 mixCol = mix(palette[idx], palette[idx+1], weight );


// alpha  fades from the second color
float alpha =pow(( 1.0-heat), 2.0) ;

vec4 rgba  = vec4(mixCol,alpha);;

return rgba;
		}

		//_____________MAIN
		
		void main() {

			//float depth = getLinearDepth( vUv ); // to display depth material
            //float fragDepth = texture2D(tDepth, vUv).r;
        	//float viewZ = perspectiveDepthToViewZ(fragDepth, cameraNear, cameraFar);


  			vec3 worldPos = getWorldPosition(vUv); 


			//HEAT
			// looop through all points to find the  closest
			float intensity =MAX_DIST; // set default max_dist

			 for (int i = 0; i < gazePointsLen ; i++){

			 vec3 pt = vec3( gazePoints[i*4], gazePoints[i*4+1], gazePoints[i*4+2] );
			  // check distance
              float dist=  distance( pt.xyz, worldPos.xyz );
			 intensity = intensity < dist? intensity:dist;

  }
			//intensity *=.00000001;
  
			//gradient color
		   // vec3 gradCol = makeRainbow(intensity);
		    vec4 gradCol = applyGradient(intensity/MAX_DIST); 
 			float alpha =  ( 1.0- intensity) * ( 1.0- intensity) ;

			// render points only
			if (intensity < MAX_DIST){
			gl_FragColor = vec4( gradCol);
			}

		//	gl_FragColor = vec4( vec3( 1.0 - depth*100.0 ), 1 ); //depth

		}`,
  };
}
export default HMPassShader;
