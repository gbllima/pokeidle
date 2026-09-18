varying vec2 v_TexCoord;
uniform vec4 u_Color;
uniform vec2 u_Resolution;
uniform sampler2D u_Tex0;

float Pi = 6.28318530718; // Pi*2

// GAUSSIAN BLUR SETTINGS {{{
float Directions = 10.0; // BLUR DIRECTIONS (Default 16.0 - More is better but slower)
float Quality = 4.0; // BLUR QUALITY (Default 4.0 - More is better but slower)
float Size = 2.5; // BLUR SIZE (Radius, Default 8.0)
// GAUSSIAN BLUR SETTINGS }}}

void main() {   
    vec2 Radius = Size/u_Resolution.xy;
    
    // Pixel colour
    vec4 Color = texture2D(u_Tex0, v_TexCoord) * u_Color;
    
    // Blur calculations
    for( float d=0.0; d < Pi; d += Pi/Directions)
    {
		for(float i = 1.0/Quality; i <= 1.0; i += 1.0/Quality)
        {
			Color += texture2D(u_Tex0, v_TexCoord + vec2(cos(d), sin(d)) * Radius * i) * 0.75;
        }
    }
    
    // Output to screen
    Color.rgb /= (Quality * Directions) - Directions;
    gl_FragColor = Color;
}