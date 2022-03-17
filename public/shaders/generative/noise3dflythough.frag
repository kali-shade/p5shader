precision mediump float;
//vec3 verdejpupper(){return vec3(0.0,1.0,0.8);}

// we need the sketch resolution to perform some calculations
uniform vec2 resolution ;
uniform float time ;
uniform vec2 mouse ;

#define iTime time
#define iResolution resolution
#define pi 3.14159265359

/*
 float CameraSpeed = 0.63;
 float NoiseScale = 0.71;
 float MaxSteps = 0.63;
 float TunnelRadius = 0.87;
 float NoiseIsoline = 0.27;*/



uniform float CameraSpeed ;
uniform float NoiseScale ;
uniform float MaxSteps ;
uniform float TunnelRadius ;
uniform float NoiseIsoline ;
 
const float FOV = 0.4;
const float MarchDumping = 0.7579;
const float Far = 38.925;
//const int MaxSteps = 300;

const float TunnelSmoothFactor = 2.0;
//const float TunnelRadius = 0.15660005;
const float TunnelFreqA = 0.18003;
const float TunnelFreqB = 0.25;
const float TunnelAmpA = 3.6230998;
const float TunnelAmpB = 2.4324;
//const float NoiseIsoline = 0.319;

const vec3 Color = vec3(0.085, 0.658, 1.0);

#define M_NONE -1.0
#define M_NOISE 1.0

float mapr(float _value,float _low2,float _high2) {
	float val = _low2 + (_high2 - _low2) * (_value - 0.) / (1.0 - 0.);
    //float val = 0.1;
	return val;
}

float hash(float h) {
	return fract(sin(h) * 43758.5453123);
}

float noise(vec3 x) {
	vec3 p = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);

	float n = p.x + p.y * 157.0 + 113.0 * p.z;
	return mix(
			mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
					mix(hash(n + 157.0), hash(n + 158.0), f.x), f.y),
			mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
					mix(hash(n + 270.0), hash(n + 271.0), f.x), f.y), f.z);
}

float fbm(vec3 p) {
	float f = 0.0;
	f = 0.5000 * noise(p);
	p *= 2.01;
	f += 0.2500 * noise(p);
	p *= 2.02;
	f += 0.1250 * noise(p);

	return f;
}

// by iq. http://iquilezles.org/www/articles/smin/smin.htm
float smax(float a, float b, float k) {
	float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
	return mix(a, b, h) + k * h * (1.0 - h);
}

// From "Subterranean Fly-Through" by Shane https://www.shadertoy.com/view/XlXXWj
vec2 path(float z) {
	return vec2(TunnelAmpA * sin(z * TunnelFreqA), TunnelAmpB * cos(z * TunnelFreqB));
}

float noiseDist(vec3 p) {

	float mapnoise= mapr(NoiseScale,0.0,4.0);
	p = p / mapnoise;
	return (fbm(p) - NoiseIsoline) * mapnoise;
}

vec2 map(vec3 p) {
	float d = noiseDist(p);
	float d2 = length(p.xy - path(p.z)) - TunnelRadius;
	d = smax(d, -d2, TunnelSmoothFactor);

	vec2 res = vec2(d, M_NOISE);
	return res;
}

vec2 castRay(vec3 ro, vec3 rd) {
	float tmin = 0.0;
	float tmax = Far;

	float precis = 0.002;
	float t = tmin;
	float m = M_NONE;
	
//	int(mapr(MaxSteps,0.0,100.0)
	const int cnt = 60;
	for (int i = 0; i < cnt; i++) {
		vec2 res = map(ro + rd * t);
		if (res.x < precis || t > tmax) {
			break;
		}
		t += res.x * MarchDumping;
		m = res.y;
	}
	
	if (t > tmax) {
		m = M_NONE;
	}
	return vec2(t, m);
	
	//return vec2(0.0);
}

float softshadow(vec3 ro, vec3 rd, float mint, float tmax) {
	float res = 1.0;
	float t = mint;

	
	const int cnt = 16;
	for (int i = 0; i < cnt; i++) {
		float h = map(ro + rd * t).x;

		res = min(res, 8.0 * h / t);
		t += clamp(h, 0.02, 0.10);

		if (h < 0.001 || t > tmax) {
			break;
		}
	}
	return clamp(res, 0.0, 1.0);
}

vec3 calcNormal(vec3 pos) {
	vec2 eps = vec2(0.001, 0.0);

	vec3 nor = vec3(map(pos + eps.xyy).x - map(pos - eps.xyy).x,
			map(pos + eps.yxy).x -+ map(pos - eps.yxy).x,
			map(pos + eps.yyx).x - map(pos - eps.yyx).x);
	return normalize(nor);
}

float calcAO(vec3 pos, vec3 nor) {
	float occ = 0.0;
	float sca = 1.0;
	
	const int cnt = 5;
	for (int i = 0; i < cnt; i++) {
		float hr = 0.01 + 0.12 * float(i) / 4.0;
		vec3 aopos = nor * hr + pos;
		float dd = map(aopos).x;

		occ += -(dd - hr) * sca;
		sca *= 0.95;
	}
	return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

vec3 render(vec3 ro, vec3 rd) {
	vec3 col = vec3(0.0);
	vec2 res = castRay(ro, rd);
	float t = res.x;
	float m = res.y;

	if (m > -0.5) {
		vec3 pos = ro + t * rd;
		vec3 nor = calcNormal(pos);

		// material
		
		col = Color + sin(t * 0.8) * 0.3;
		col += 0.3 * sin(vec3(0.15, 0.02, 0.10) * iTime * 6.0);

		// lighitng
		float occ = calcAO(pos, nor);
		vec3 lig = -rd;
		float amb = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);
		float dif = clamp(dot(nor, lig), 0.0, 1.0);

		float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 2.0);

		vec3 ref = reflect(rd, nor);
		float spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);

		dif *= softshadow(pos, lig, 0.02, 2.5);

		vec3 brdf = vec3(0.0);
		brdf += 1.20 * dif * vec3(1.00, 0.90, 0.60);
		brdf += 1.20 * spe * vec3(1.00, 0.90, 0.60) * dif;

		// Additional specular lighting trick,
		// taken from "Wet stone" by TDM
		// https://www.shadertoy.com/view/ldSSzV
		nor = normalize(nor - normalize(pos) * 0.2);
		ref = reflect(rd, nor);
		spe = pow(clamp(dot(ref, lig), 0.0, 1.0), 100.0);
		brdf += 2.20 * spe * vec3(1.00, 0.90, 0.60) * dif;

		brdf += 0.40 * amb * vec3(0.50, 0.70, 1.00) * occ;
		brdf += 0.40 * fre * vec3(1.00, 1.00, 1.00) * occ;

		col = col * brdf;

		col = mix(col, vec3(0.0), 1.0 - exp(-0.005 * t * t));
	}
	return vec3(clamp(col, 0.0, 1.0));
}

mat3 rotationZ(float a) {
	float sa = sin(a);
	float ca = cos(a);
	return mat3(ca, sa, 0.0, -sa, ca, 0.0, 0.0, 0.0, 1.0);
}

mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}


void main() {
	vec2 q = gl_FragCoord.xy / iResolution.xy;
	vec2 coord = 2.0 * q - 1.0;
	coord.x *= iResolution.x / iResolution.y;
	coord *= FOV;

    float t = iTime * mapr(CameraSpeed,-4.0,4.0) + 4.0 * 60.0;
    vec3 ro = vec3(path(t), t);

    t += 0.5;
    vec3 target = vec3(path(t), t);
    vec3 dir = normalize(target - ro);
	
	

	//up*=rotxz;
	//dir.xz*=rotyz;
	//dir.xy*=rotyz
	//target.xz *=rotxz;

    vec3 up = vec3(-0.9309864, -0.33987653, 0.1332234) * rotationZ(iTime * 0.05);
    vec3 upOrtho = normalize(up - dot(dir, up) * dir);
	
	
	
	
	
	
	
    vec3 right = normalize(cross(dir, upOrtho));


//	right.x+=mouse.x;



    vec3 rd = normalize(dir + coord.x * right + coord.y * upOrtho);



	mat2 rotyz = rotate2d(mouse.x*5.0);
	mat2 rotxz = rotate2d(mouse.y*2.0);
	//	mat2 rotyz = rotate2d(mouse.x*2.0);
	rd.yz*=rotyz;
	rd.xz*=rotxz;
    /*
    from.xz*=rotxz;
    dir.xz*=rotxz;
    from.xy*=rotyz;
    dir.xy*=rotyz;*/






    vec3 col = render(ro, rd);
	
    col = pow(col, vec3(0.4545));

    gl_FragColor = vec4(col, 1.0);
}