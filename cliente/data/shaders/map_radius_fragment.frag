precision mediump float;

varying vec2 v_TexCoord;
varying vec2 v_TexCoord2;

uniform vec4 u_Color;
uniform sampler2D u_Tex0;
uniform sampler2D u_Tex1;

void main()
{
    // Aplicando efeito de borda arredondada
    vec2 centeredCoord = v_TexCoord - 0.5;
    float distance = length(centeredCoord);

    // Ajustando o valor para fazer a borda completamente transparente
    float mask = smoothstep(0.5 - 0.01, 0.5, distance);

    // Combinando as texturas e aplicando a máscara
    vec4 color = texture2D(u_Tex0, v_TexCoord) * u_Color;
    color += texture2D(u_Tex1, v_TexCoord2);

    // Mantendo a parte interior do arco-íris e tornando a borda completamente transparente
    gl_FragColor = mix(color, vec4(color.rgb, 0.0), mask);

    // Descartando pixels transparentes
    if (gl_FragColor.a < 0.01)
        discard;
}
