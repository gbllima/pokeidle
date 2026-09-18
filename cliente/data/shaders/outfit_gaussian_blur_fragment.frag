

varying vec2 v_TexCoord;
uniform sampler2D u_Tex0;
vec2 delta = vec2(0.0035, 0.0035);

void main() {

	gl_FragColor =	texture2D( u_Tex0, v_TexCoord);
	gl_FragColor.rgb = gl_FragColor.rgb * 0.25 +
		texture2D( u_Tex0, v_TexCoord  + delta).rgb * 0.0625 +
		texture2D( u_Tex0, v_TexCoord  - delta).rgb * 0.0625 +
		texture2D( u_Tex0, v_TexCoord  + delta * vec2(1, -1)).rgb * 0.0625 +
		texture2D( u_Tex0, v_TexCoord  + delta * vec2(- 1,1)).rgb * 0.0625 +

		texture2D( u_Tex0, v_TexCoord  + delta * vec2(1, 0)).rgb * 0.125 +
		texture2D( u_Tex0, v_TexCoord  - delta * vec2(0, 1)).rgb * 0.125 +
		texture2D( u_Tex0, v_TexCoord  + delta * vec2(-1,0)).rgb * 0.125 +
		texture2D( u_Tex0, v_TexCoord  + delta * vec2(0,-1)).rgb * 0.125;
}