import sys
import os
import threading
import pystray
from PIL import Image, ImageDraw
import pynput.mouse as mouse
import winreg
import pygame

# ========== 初始化 pygame.mixer ==========
pygame.mixer.init(frequency=22050, size=-16, channels=2, buffer=512)

# ========== 配置 ==========
SOUND_FILE = "click.wav"
ICON_FILE = "icon.ico"
ENABLED = True

# ========== 获取路径 ==========
def get_base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    else:
        return os.path.dirname(os.path.abspath(__file__))

def get_sound_path():
    return os.path.join(get_base_dir(), SOUND_FILE)

# ========== 播放音效（pygame 多声道，真正重叠） ==========
def play_sound():
    if not ENABLED:
        return
    try:
        sound = pygame.mixer.Sound(get_sound_path())
        sound.play()   # 立即返回，不阻塞，多个声音同时播放
    except Exception:
        pass

# ========== 鼠标回调 ==========
def on_click(x, y, button, pressed):
    if pressed:
        play_sound()

# ========== 开机自启动管理 ==========
def set_autostart(enabled):
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
        if enabled:
            exe_path = sys.executable if getattr(sys, 'frozen', False) else sys.argv[0]
            winreg.SetValueEx(key, "MouseSound", 0, winreg.REG_SZ, exe_path)
        else:
            try:
                winreg.DeleteValue(key, "MouseSound")
            except FileNotFoundError:
                pass
        winreg.CloseKey(key)
    except Exception as e:
        print("设置开机自启动失败:", e)

def is_autostart_enabled():
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ)
        winreg.QueryValueEx(key, "MouseSound")
        winreg.CloseKey(key)
        return True
    except:
        return False

# ========== 托盘图标 ==========
def create_image():
    icon_path = os.path.join(get_base_dir(), ICON_FILE)
    try:
        return Image.open(icon_path)
    except Exception:
        width, height = 64, 64
        image = Image.new('RGB', (width, height), (40, 40, 40))
        dc = ImageDraw.Draw(image)
        dc.rectangle((10, 20, 20, 44), fill=(255, 255, 255))
        dc.polygon([(20, 24), (34, 16), (34, 48), (20, 40)], fill=(255, 255, 255))
        dc.ellipse((36, 28, 48, 40), outline=(255, 255, 255), width=2)
        return image

# ========== 托盘菜单 ==========
def on_quit(icon, item):
    listener.stop()
    pygame.mixer.quit()
    icon.stop()
    sys.exit()

def toggle_autostart(icon, item):
    enabled = not is_autostart_enabled()
    set_autostart(enabled)
    icon.menu = get_menu()

def get_menu():
    status = "关闭" if is_autostart_enabled() else "开启"
    return pystray.Menu(
        pystray.MenuItem(f"开机自启动 {status}", toggle_autostart),
        pystray.MenuItem("退出", on_quit)
    )

# ========== 主函数 ==========
def main():
    global listener
    listener = mouse.Listener(on_click=on_click)
    listener.start()
    icon = pystray.Icon("mouse_sound", create_image(), "震颤引爆", get_menu())
    icon.run()

if __name__ == "__main__":
    main()