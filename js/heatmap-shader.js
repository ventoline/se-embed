// heatmap shader for the scene
import * as THREE from "three";

export class heatmapShader {
  //shader for heatmap overlay on scene

  //vertex
  vertexShader = `
#include <packing>

varying vec2 vUv;
varying vec2 posWorld;
  out float isBorder;

uniform int shapeLen;
 uniform  vec2 shapeArr[shapeArrayLength];
  out float heat;

  uniform sampler2D depthTex;
  uniform float maxDistance;

  void main(){
   
    vUv = uv; 

    pos = position.xy ; 
posWorld = position;


    //check if gazepoint time > current
// check if close to a gaze point

heat = dist()
//get additional intensity

//loop through the gazepoints

   vec4 modelPosition = modelMatrix * vec4(position, 1.0);
   //vec4 modelPosition = modelMatrix * vec4(heightenedPos, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 clipPosition = projectionMatrix * viewPosition;
    gl_Position = clipPosition;

  }
  `;

  //fragment
  fragmentShader = `

// in 
varying vec2 vUv;
varying vec3  posWorld;

//border
 uniform  int shapeLen;
 uniform  vec2 shapeArr[shapeArrayLength];
 uniform float uWidth;
 uniform vec2 uCenter;

//pattern
//uniform vec3 uShadow;
uniform vec3 uColor;
vec3 gradientColor ;
vec3 blu;
uniform float alpha;

float isShown; 
float isBound; 

void main() {

//border

//for each side / corner
  for (int i = 0; i < shapeLen ; i++){

    highp vec2 AB; //egde vector (AB)
    highp vec2 B;
   
     //edge vector
    if( i < (shapeLen-1 )){ int next = i+1;
    AB = shapeArr[next] - shapeArr[i] ;  }
    else{ AB  = vec2( shapeArr[0] - shapeArr[i]  ) ; } //close the shape
    vec2 ABnorm = normalize(AB);  //unit vector of the edge
    float ABlen = length(AB);//distance( shapeArr[i], B );

    //vector corner to position (AX)
    vec2 AX = vUv - shapeArr[i] ;
    float  AXlen  = length(AX);  
     vec2 AXnorm = normalize(AX);      //unit vector

      /* //test corners
  float dist = distance(shapeArr[i], vUv );
     if(dist < .150){isBorder = 1.0;}*/
    
  float dotSide = dot(AX, AB);//dot product to project point to edge
  float angle = acos(dot(ABnorm, AXnorm)); //angle of both vectors
  float APlen = cos(angle) * AXlen; //length of projected vector 
  float XPlen = sqrt( pow(AXlen, 2.0) - pow(APlen, 2.0));// distance to edge 

    // check distance to edge
  if(XPlen < uWidth ){
   // straightborders
    isBound = 1.0;

   }
  }


// gradient to cyan___________________
blu =vec3(0.008,0.0035,0.31); // color-extra-midnight-dash3-600  ;//vec3(0.05098039215,0.0431372549, 0.15686274509 ); // color-extra-midnight-dash3-900// cyan blu // vec3(0.01,1.0,1.0);
//vec3(0.0,0.000,.00);//vec3(0.008,0.0035,0.31); // color-extra-midnight-dash3-600 // vec3(0.01,1.0,1.0);
//ratio
float ratio = length(vUv -shapeArr[0]) / length(shapeArr[2] -shapeArr[0]);
gradientColor =mix(uColor,blu, ratio/1.5) ;  // weighted towards blu // //gradientColor =mix(uColor,blu,  (vUv.y - vUv.x)/2.0 ) ;  // weighted towards blu //  pow(vUv.x,  2.0) *   pow(vUv.y  , 2.0) ;


//cross pattern_________________________
isShown = ( (mod(vUv.x - .025, .2)  < 0.01  && mod(vUv.y, .2) < 0.06 ) ||( mod(vUv.y -0.025, .2) < 0.01  && mod(vUv.x, .2) < 0.06 )// && vUv.y > -1.5 
)? 1.0: 0.0;
//make a mask
//isShown = isBorder!=0.0 || isShown!=0.0 ? 1.0: 0.0;
isShown = isBound!=0.0 || isShown!=0.0 ? 1.0: 0.0;


//tracking space dot
//square
//if((abs( uCenter.x -vUv.x) < .1) && (abs(uCenter.y - vUv.y) < .1) ) { isShown = 1.0;}
//dot 
if (distance( uCenter, vUv )-.03 < .06  && distance( uCenter, vUv )-.0275 > .055
||distance( uCenter, vUv )-.0225 < .045
)
{ isShown = 1.5;
//gradientColor = mix(blu, uColor, 1.0-ratio);
gradientColor.r *= 2.5;
gradientColor.g *= 2.5;
gradientColor.b *= 2.5;

}




//gl_FragColor = vec4(uColor , isBorder * alpha);
   gl_FragColor = vec4(gradientColor , (isShown) * alpha);

}



  `;

  //settings and material____________________________________

  uniforms = {
    uColor: { type: "vec3", value: new THREE.Vector3(0.9, 0.9, 0.9) },
    alpha: { type: "float", value: 0.95 },
  };

  heatmapShader = new THREE.ShaderMaterial({
    uniforms: this.uniforms,
    fragmentShader: this.fragmentShader,
    vertexShader: this.vertexShader,
  });
}

export default heatmapShader;
