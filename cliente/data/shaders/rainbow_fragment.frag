uniform mat4 u_Color;
varying vec2 v_TexCoord;
varying vec2 v_TexCoord2;
uniform sampler2D u_Tex0;
uniform float u_Time;

void main()
{
	gl_FragColor = texture2D(u_Tex0, v_TexCoord);
    vec4 texcolor = texture2D(u_Tex0, v_TexCoord2);
    if(texcolor.r > 0.9) {
        gl_FragColor *= texcolor.g > 0.9 ? u_Color[0] : u_Color[1];
    } else if(texcolor.g > 0.9) {
        gl_FragColor *= u_Color[2];
    } else if(texcolor.b > 0.9) {
        gl_FragColor *= u_Color[3];
    }

	gl_FragColor.r *= sin(0.5 * (v_TexCoord.y * 120.) + (v_TexCoord.x * 30.) + u_Time * 3. + 0.) * 0.5 + 0.65;
	gl_FragColor.g *= sin(0.2 * (v_TexCoord.y * 100.) + (v_TexCoord.x * 10.) + u_Time * 9. + 2.) * 1.5 + 0.65;
	gl_FragColor.b *= sin(0.5 * (v_TexCoord.y * 100.) + (v_TexCoord.x * 70.) + u_Time * 9. + 4.) * 0.5 + 2.65;

	if(gl_FragColor.a < 0.01) {
		discard;
	}
	
}