//----------------------------------------------------------------------------------------------------------------------
//DATA------------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
var vertexShaderSource = `#version 300 es
    in vec4 a_pos;

    out vec3 rd;
    out vec3 ro;
    
    void main(){
        
        ro = vec3(a_pos.xy, 0);
        rd = vec3(0, 0, -0.6) - ro;
        
        gl_Position = vec4(a_pos.xy,1,1);
    }
`;

var fragmentShaderSource = `#version 300 es
    precision mediump float;

    const float MIN_DIST = 0.01f;
    const float MAX_DIST = 128.f;
    const int MAX_STEPS = 128;
    
    const vec3 lightDir = normalize(vec3(1.5,.76,-1));
    const vec3 lightCol = vec3(0.92,0.9,0.7);

    const vec3 skyCol = vec3(.1,0.15,0.5);
    const vec3 floorCol = vec3(0.12,0.07,0.04);
    const vec3 horizonCol = vec3(0.1,0.1,0.17);
    
    uniform float time;

    in vec3 rd;
    in vec3 ro;

    out vec4 color;

    vec2 N22(vec2 p){
        vec3 a = fract(p.xyx * vec3(123.34,234.34,345.65));
        a+=dot(a,a+34.45);
        return fract(vec2(a.x*a.y, a.y*a.z));
    }

    vec2 wavedx(vec2 position, vec2 direction, float speed, float frequency, float timeshift) {
        float x = dot(direction, position) * frequency + timeshift * speed;
        float wave = exp(sin(x) - 1.0);
        float dx = wave * cos(x);
        return vec2(wave, -dx);
    }

    float getwaves(vec2 position, int iterations){
        float iter = 0.0;
        float phase = 6.0;
        float speed = 2.0;
        float weight = 1.0;
        float w = 0.0;
        float ws = 0.0;
        float DRAG_MULT = 0.048;
        for(int i = 0; i < iterations; i++) {
            vec2 p = vec2(sin(iter), cos(iter));
            vec2 res = wavedx(position, p, speed, phase, time);
            position += normalize(p) * res.y * weight * DRAG_MULT;
            w += res.x * weight;
            iter += 12.0;
            ws += weight;
            weight = mix(weight, 0.0, 0.2);
            phase *= 1.18;
            speed *= 1.07;
        }
        return w / ws;
    }

    vec3 dirLight(vec3 n, float shadow) {
        return min(max(0., dot(n, lightDir)),shadow) * lightCol;
    }

    vec3 ambient(vec3 n) {
        vec3 col = max(0.,dot(n,vec3(0,1,0))) * skyCol;
        col += max(0.,dot(n, vec3(0,-1,0))) * floorCol;
        col += max(0.,1. - abs(dot(n,vec3(0,1,0)))) * horizonCol;
        return col;
    }
    
    float fresnel(vec3 n){
        return 1.0 - max(0.0, dot(rd, n));
    }

    float specular(vec3 n, vec3 rd) {
        float metallness = .25;
        float spec = max(0.,dot(lightDir, reflect(rd, n)));
        float f = fresnel(n);
        return spec*spec*spec*f;
    }

    float sdf_sphere(vec3 p, float r){
        return length(p)-r;
    }

    float map(vec3 p){
        float addition = sin(p.x*5.0f + time*5.0f)*.15f;
        //float sph = sdf_sphere(p-vec3(addition,0,-5), sin(time)+1.5);
        float sph = 999.;

        //SEA-----------------------------------
        float d = length(p - ro);
        p.y -= d*d*.002;
        vec2 boatSpeed = vec2(0.,-.5);
        vec2 seaPos = p.xz*.25 + time * boatSpeed;
        float waveHeight = getwaves(seaPos, 8);

        //float floor = sdf_sphere(p-vec3(0, 51,3), 48.0 + waveHeight);
        float floor = -(p.y + waveHeight)+3.;
        return min(floor, sph);
    }

    vec3 calcNormal(vec3 p){

        float d = map(p);
        return normalize(vec3(
            d-map(p + vec3(MIN_DIST, 0, 0)),
            d-map(p + vec3(0, MIN_DIST, 0)),
            d-map(p + vec3(0, 0, MIN_DIST))));
    }

    float raymarch(vec3 ro, vec3 rd){
        float d = 0.0;
        for(int i = 0; i < MAX_STEPS; i++){
            vec3 p = ro + rd*d;
            float t = map(p);
            if(t < MIN_DIST) break;
            d+=t;
            if(d > MAX_DIST) break;
        }
        if(d > MAX_DIST) d = -1.0;
        return d;
    }

    float shadow(vec3 ro, vec3 rd) {
        float res = MAX_DIST;
        float d = 0.0;
        for(int i = 0; i < MAX_STEPS; i++){
            vec3 p = ro + rd * d;
            float t = map(p);
            res = min(res, MAX_DIST * max(t, 0.0)/d);

            if(res < MIN_DIST) break;
            d += clamp(t, MIN_DIST, .01f);
        }
        return res;
    }

    void main() {
        float d = raymarch(ro,rd);
        vec3 hit = ro + rd * d;
        if(d < 0.0){
            color = vec4(ambient(-rd)*5.,1.);
            return;
        }
        vec3 n = calcNormal(hit);
        float shadow = shadow(hit-n*MIN_DIST, -lightDir);
        float fresnel = fresnel(n);
        fresnel*=fresnel*fresnel;
        vec3 col = fresnel * skyCol*5.;
        //vec3 col = dirLight(n, shadow)*1.0-fresnel;
        col += ambient(n);
        col+= specular(n, -rd);
        float depth = d/64.0;
        col = mix(col, skyCol*5., depth*depth);
        color = vec4(col,1);
    }`;

let bufferData = new Float32Array(
    [1, -1, 1, 1,
        -1, -1, 1, 1,
        -1, 1, 1, 1,
        1, 1, 1, 1]);

let bufferElem = new Uint16Array([0, 1, 2, 0, 2, 3]);

//----------------------------------------------------------------------------------------------------------------------
//RENDER SETUP----------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
var createShader = function (gl, src, type) {
    let shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return shader;

    console.log(((type == gl.VERTEX_SHADER) ? 'VERTEX' : 'FRAGMENT') + '_SHADER failed compilation:');
    console.log(gl.getShaderInfoLog(shader));

    gl.deleteShader(shader);
};

let createProgram = function (gl, vShader, fShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vShader);
    gl.attachShader(program, fShader);
    gl.linkProgram(program);

    if (gl.getProgramParameter(program, gl.LINK_STATUS))
        return program;

    console.log(gl.getProgramParameter(program, gl.LINK_STATUS));
    gl.deleteProgram(program);
};

var canvas = document.getElementById('canvas');

var gl = canvas.getContext('webgl2');

//shaders---------------------------------------------------------------------------------------------------------------
var vShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
var fShader = createShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

//program---------------------------------------------------------------------------------------------------------------
var program = createProgram(gl, vShader, fShader);
gl.useProgram(program);

//arrayBuffer---------------------------------------------------------------------------------------------------------------
let buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, bufferData, gl.STATIC_DRAW);

//vao-------------------------------------------------------------------------------------------------------------------
let vao = gl.createVertexArray();
gl.bindVertexArray(vao);

let attrib = gl.getAttribLocation(program, 'a_pos');
gl.enableVertexAttribArray(attrib);
gl.vertexAttribPointer(attrib,
    4,
    gl.FLOAT,
    false,
    4 * 4,
    0
);
//elemBuffer------------------------------------------------------------------------------------------------------------
let elemBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, bufferElem, gl.STATIC_DRAW);
//uniform---------------------------------------------------------------------------------------------------------------
var u_time = gl.getUniformLocation(program, 'time');
gl.uniform1f(u_time,0);
//----------------------------------------------------------------------------------------------------------------------
//RENDER----------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
var startTime = performance.now();
gl.clearColor(0, 0, 0, 1);

var gameloop = function(){
    gl.uniform1f(u_time, (performance.now()-startTime)/1000.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    requestAnimationFrame(gameloop);
};

requestAnimationFrame(gameloop);

