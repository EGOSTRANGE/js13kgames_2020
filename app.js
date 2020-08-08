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

                in vec3 rd;
                in vec3 ro;
                
                uniform vec2 u_color;
                
                out vec4 color;

                float sdf_sphere(vec3 p, float r){
                    return length(p)-r;
                }

                float map(vec3 p){
                    return sdf_sphere(p-vec3(0,0,-5), 1.0);
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
                    
                    for(int i = 0; i < 128; i++){
                        vec3 p = ro + rd*d;
                        float t = map(p);
                        if(t < MIN_DIST) break;
                        d+=t;
                        if(d > MAX_DIST) break;
                    }
                    if(d > MAX_DIST) d = -1.0;
                    return d;
                }

                void main(){
                    float d = raymarch(ro,rd);
                    if(d < 0.0){
                        color = vec4(0);
                    }
                    color = vec4(calcNormal(ro+rd*d),1);
                }
            `;

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

//----------------------------------------------------------------------------------------------------------------------
//RENDER----------------------------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------------------------------
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);



