#ifndef ANDROID_WINDOW_H
#define ANDROID_WINDOW_H

#include "platformwindow.h"

class AndroidWindow : public PlatformWindow {
    enum EventType {
        TOUCH_DOWN,
        TOUCH_UP,
        TOUCH_MOTION,
        TOUCH_LONGPRESS,
        KEY_DOWN,
        KEY_UP,
        TEXTINPUT,
        EVENT_UNDEFINED
    };

    enum NativeMessage {
        RECREATE_CONTEXT,
        APP_TERMINATE
    };

    void internalInitGL();
    void internalDestroyGL();

    void internalCheckGL();
    void internalChooseGL();
    void internalCreateGLContext();
    void internalDestroyGLContext();
    void internalConnectGLContext();


public:
    AndroidWindow();
    ~AndroidWindow();

    void init() override;
    void init(struct android_app* app);
    void terminate() override;
    void move(const Point& pos) override;
    void resize(const Size& size) override;
    void show() override;
    void hide() override;
    void minimize() override;
    void maximize() override;
    void poll() override;
    void swapBuffers() override;
    void showMouse() override;
    void hideMouse() override;

    void setMouseCursor(int cursorId) override;
    void restoreMouseCursor() override;

    void setTitle(const std::string& title) override;
    void setMinimumSize(const Size& minimumSize) override;
    void setFullscreen(bool fullscreen) override;
    void setVerticalSync(bool enable) override;
    void setIcon(const std::string& iconFile) override;
    void setClipboardText(const std::string& text) override;

    Size getDisplaySize() override;
    std::string getClipboardText() override;
    std::string getPlatformType() override;
    int getPressedMouseButton() override;

    void displayFatalError(const std::string& message) override;
    void showTextEditor(const std::string& title, const std::string& description, const std::string& text, int flags) override;

    void handleCmd(int32_t cmd);
    int handleInput(AInputEvent* event);
    void updateSize();
    void handleTextInput(std::string text) override;
    void openUrl(std::string url);

protected:
    int internalLoadMouseCursor(const ImagePtr& image, const Point& hotSpot) override { return -1; };

    JNIEnv* getJNIEnv()
    {
        return g_androidState->activity->env;
    }
    JavaVM* getJavaVM()
    {
        return g_androidState->activity->vm;
    }
    jobject getClazz()
    {
        return g_androidState->activity->clazz;
    }

private:
    EGLConfig m_eglConfig;
    EGLContext m_eglContext;
    EGLDisplay m_eglDisplay;
    EGLSurface m_eglSurface;
    InputEvent m_multiInputEvent[3];
};

extern AndroidWindow g_androidWindow;;

#endif