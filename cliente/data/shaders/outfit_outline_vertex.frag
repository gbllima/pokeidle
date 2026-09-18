attribute vec2 a_TexCoord;
uniform mat3 u_TextureMatrix;
varying vec2 v_TexCoord;
varying vec2 v_TexCoord2;
varying vec2 v_TexCoord3;
varying vec2 v_Position;
attribute vec2 a_Vertex;
uniform mat3 u_TransformMatrix;
uniform mat3 u_ProjectionMatrix;
uniform vec2 u_Offset;
uniform vec2 u_Resolution;
uniform vec2 u_Center;

void main()
{
    vec2 vertex = a_Vertex;
    vec2 text = a_TexCoord;
    vec2 text2 = a_TexCoord;
    
    float outlineThickness = 1.0; // Aumente esse valor para aumentar a espessura do contorno

    if(vertex.x < u_Center.x) {
        vertex.x -= outlineThickness;
        text.x -= outlineThickness;
    }
    if(vertex.x > u_Center.x) {
        vertex.x += outlineThickness;
        text.x += outlineThickness;
    }
    if(vertex.y < u_Center.y) {
        vertex.y -= outlineThickness;
        text.y -= outlineThickness;
    }
    if(vertex.y > u_Center.y) {
        vertex.y += outlineThickness;
        text.y += outlineThickness;
    }
    
    gl_Position = vec4((u_ProjectionMatrix * u_TransformMatrix * vec3(vertex.xy, 1.0)).xy, 1.0, 1.0);
    v_Position = a_Vertex.xy - u_Center;
    v_TexCoord = (u_TextureMatrix * vec3(text,1.0)).xy;
    v_TexCoord2 = (u_TextureMatrix * vec3(text + u_Offset * outlineThickness,1.0)).xy;
    v_TexCoord3 = (u_TextureMatrix * vec3(text2,1.0)).xy;
}
