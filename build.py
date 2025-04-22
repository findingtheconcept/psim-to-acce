#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import platform
import shutil
import subprocess
import sys

def create_shortcut(exe_path, icon_path, shortcut_path):
    """
    Create a Windows shortcut (.lnk) for the given exe file with the specified icon.
    
    :param exe_path: Full path to the compiled exe file.
    :param icon_path: Full path to the icon file.
    :param shortcut_path: Full path where the .lnk file will be created.
    """
    try:
        import win32com.client
        shell = win32com.client.Dispatch("WScript.Shell")
        shortcut = shell.CreateShortCut(shortcut_path)
        shortcut.TargetPath = exe_path
        shortcut.WorkingDirectory = os.path.dirname(exe_path)
        shortcut.IconLocation = icon_path  # Specify the icon for the shortcut
        shortcut.save()
        print(f"Shortcut created at: {shortcut_path}")
    except Exception as e:
        print(f"Failed to create shortcut: {e}")

def build_windows():
    """
    Build the Windows executable using PyInstaller.
    - Checks for the existence of the main script and icon.
    - Removes previous builds.
    - Executes the PyInstaller command with the provided icon.
    - Creates a shortcut for the generated executable with the same icon.
    """
    project_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(project_dir, 'assets')
    static_dir = os.path.join(project_dir, 'static')
    app_script = os.path.join(project_dir, 'src', 'app.py')
    icon_path = os.path.join(static_dir, 'img', 'favicon.ico')
    dist_dir = os.path.join(project_dir, 'dist')

    # Check if the main application script exists
    if not os.path.exists(app_script):
        print(f"Error: {app_script} does not exist.")
        sys.exit(1)

    # Check if the icon file exists
    if not os.path.exists(icon_path):
        print(f"Warning: {icon_path} not found. Build will proceed without custom icon.")
    
    # Remove existing build directory and spec file if they exist
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
        print("Removed old 'dist' directory.")
    
    spec_file = os.path.join(project_dir, 'build.spec')
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print("Removed existing build.spec file.")

    # Prepare PyInstaller command
    icon_path = os.path.join(project_dir, 'assets', 'app_icon.ico')

    pyinstaller_cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--onefile',
        '--windowed',
        '--noconfirm',
        '--icon', icon_path,
        '--add-data', f"{assets_dir}{os.path.pathsep}assets",
        '--add-data', f"{static_dir}{os.path.pathsep}static",
    ]

    # Add icon parameter if icon file exists
    if os.path.exists(icon_path):
        pyinstaller_cmd.extend(['--icon', icon_path])

    pyinstaller_cmd.append(app_script)

    print("Running PyInstaller on Windows:")
    print(" ".join(pyinstaller_cmd))
    subprocess.run(pyinstaller_cmd, check=True)

    print("\nBuild complete. Checking 'dist' directory:")
    if os.path.exists(dist_dir):
        exes = [f for f in os.listdir(dist_dir) if f.endswith('.exe')]
        if exes:
            print("Found the following EXE files:")
            for exe_name in exes:
                print(" -", exe_name)
                exe_path = os.path.join(dist_dir, exe_name)
                # Shortcut will be created in the project root with the same name as the exe file.
                shortcut_path = os.path.join(project_dir, f"{os.path.splitext(exe_name)[0]}.lnk")
                # Use the icon file if available, otherwise fallback to the exe file icon.
                icon_for_shortcut = icon_path if os.path.exists(icon_path) else exe_path
                create_shortcut(exe_path, icon_for_shortcut, shortcut_path)
        else:
            print("No EXE file found.")
    else:
        print("'dist' directory not found after build.")

def build_macos():
    """
    Build the macOS app using py2app.
    - Removes old build directories.
    - Checks for the existence of the build_osx.py script.
    - Passes the icon parameter (typically an .icns file is used on macOS).
    """
    project_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(project_dir, 'static')
    # macOS usually requires .icns files; here we still pass favicon.ico.
    icon_path = os.path.join(static_dir, 'img', 'favicon.ico')
    dist_dir = os.path.join(project_dir, 'dist')

    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
        print("Removed old 'dist' directory.")

    setup_path = os.path.join(project_dir, 'build_osx.py')
    if not os.path.exists(setup_path):
        print(f"Error: {setup_path} does not exist.")
        sys.exit(1)

    print("Running py2app on macOS...")

    # Prepare command to run build_osx.py with the icon parameter
    cmd = [sys.executable, 'build_osx.py', 'py2app']
    if os.path.exists(icon_path):
        cmd.extend(['--icon', icon_path])
    else:
        print(f"Warning: {icon_path} not found. Build will proceed without custom icon.")

    subprocess.run(cmd, check=True, cwd=project_dir)

    print("\nBuild complete. Checking 'dist' directory:")
    if os.path.exists(dist_dir):
        contents = os.listdir(dist_dir)
        apps = [f for f in contents if f.endswith('.app')]
        if apps:
            print("Found the following .app bundles:")
            for a in apps:
                print(" -", a)
        else:
            print("No .app bundle found.")
    else:
        print("'dist' directory not found after build.")

def main():
    system_name = platform.system()
    if system_name == 'Windows':
        build_windows()
    elif system_name == 'Darwin':
        build_macos()
    else:
        print(f"Unsupported platform: {system_name}")
        print("This script only supports Windows (exe) and macOS (.app).")

if __name__ == "__main__":
    main()
