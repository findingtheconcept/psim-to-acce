#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import platform
import shutil
import subprocess
import sys

def build_windows():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(project_dir, 'assets')
    static_dir = os.path.join(project_dir, 'static')
    app_script = os.path.join(project_dir, 'src', 'app.py')

    if not os.path.exists(app_script):
        print(f"Error: {app_script} does not exist.")
        sys.exit(1)

    dist_dir = os.path.join(project_dir, 'dist')
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
        print("Removed old 'dist' folder.")

    spec_file = os.path.join(project_dir, 'build.spec')
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print("Removed existing build.spec.")

    excluded = []

    pyinstaller_cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--onefile',
        '--windowed',
        '--noconfirm',
        '--add-data', f"{assets_dir}{os.path.pathsep}assets",
        '--add-data', f"{static_dir}{os.path.pathsep}static",
    ] + excluded + [app_script]

    print("Running PyInstaller on Windows:")
    print(" ".join(pyinstaller_cmd))
    subprocess.run(pyinstaller_cmd, check=True)

    print("\nBuild complete. Checking dist folder:")
    if os.path.exists(dist_dir):
        exes = [f for f in os.listdir(dist_dir) if f.endswith('.exe')]
        if exes:
            print("EXE file(s) found:")
            for x in exes:
                print(" -", x)
        else:
            print("No .exe found.")
    else:
        print("No dist folder found after build.")


def build_macos():
    project_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(project_dir, 'dist')

    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
        print("Removed old 'dist' folder.")

    setup_path = os.path.join(project_dir, 'build_osx.py')
    if not os.path.exists(setup_path):
        print(f"Error: {setup_path} does not exist.")
        sys.exit(1)

    print("Running py2app on macOS...")

    cmd = [sys.executable, 'build_osx.py', 'py2app']
    subprocess.run(cmd, check=True, cwd=project_dir)

    print("\nBuild complete. Checking dist folder:")
    if os.path.exists(dist_dir):
        contents = os.listdir(dist_dir)
        apps = [f for f in contents if f.endswith('.app')]
        if apps:
            print(".app bundle(s) found:")
            for a in apps:
                print(" -", a)
        else:
            print("No .app found.")
    else:
        print("No dist folder found after build.")


def main():
    system_name = platform.system()
    if system_name == 'Windows':
        build_windows()
    elif system_name == 'Darwin':
        build_macos()
    else:
        print(f"Unsupported platform: {system_name}")
        print("This script only builds for Windows (exe) or macOS (.app).")

if __name__ == "__main__":
    main()
