precision mediump float;

uniform float u_Time;
uniform sampler2D u_Tex0;
varying vec2 v_TexCoord;

// Função para gerar ruído simples (mais leve e rápido)
float simpleNoise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100);
    for (int i = 0; i < 3; i++) {  // Reduzi para 3 iterações para melhorar o desempenho
        v += a * simpleNoise(p);
        p = p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    // Coordenadas de textura normalizadas
    vec2 uv = v_TexCoord.xy;

    // Deslocamento vertical para animar o fogo
    uv.y += u_Time * 0.5;  // Aumentei a velocidade do fogo

    // Aplicando ruído para gerar o efeito de chamas
    float noiseValue = fbm(uv * 3.0);

    // Ajustando as cores para garantir que o fogo seja laranja
    vec3 fireColor = vec3(1.0, 0.4, 0.0) * noiseValue;

    // Amostra da textura original
    vec4 texColor = texture2D(u_Tex0, v_TexCoord);

    // Considera a transparência da textura original
    if (texColor.a < 0.1) {
        discard;
    }

    // Combinação da textura original com o efeito de chamas
    gl_FragColor = mix(texColor, vec4(fireColor, texColor.a), 0.7);
}
