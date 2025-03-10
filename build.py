# -*- coding: utf-8 -*-
import os
import subprocess
import sys
import shutil

def remove_old_spec(project_dir):
    spec_file = os.path.join(project_dir, "build.spec")
    if os.path.exists(spec_file):
        os.remove(spec_file)
        print("Removed existing build.spec")

def build_exe():
    # Determine the project root based on this file's location
    project_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(project_dir, 'assets')
    static_dir = os.path.join(project_dir, 'static')
    
    # Path to the main application script
    app_script = os.path.join(project_dir, "src", "app.py")
    
    if not os.path.exists(app_script):
        print(f"File {app_script} not found!")
        sys.exit(1)
    
    remove_old_spec(project_dir)
    
    # Remove the old 'dist' folder to avoid conflicts
    dist_dir = os.path.join(project_dir, "dist")
    if os.path.exists(dist_dir):
        try:
            shutil.rmtree(dist_dir)
            print("Removed old 'dist' folder")
        except Exception as e:
            print(f"Error removing 'dist' folder: {e}")
    
    # Build the PyInstaller command using sys.executable to ensure the correct interpreter is used
    pyinstaller_command = [
        sys.executable, '-m', 'PyInstaller',
        '--clean',
        '--onefile',
        '--windowed',
        '--add-data', f'{assets_dir};assets',
        '--add-data', f'{static_dir};static',
        app_script
    ]
    
    print("Executing command:")
    print(" ".join(pyinstaller_command))
    
    try:
        subprocess.run(pyinstaller_command, check=True)
        print("Build completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error during build: {e}")
        sys.exit(1)
    
    # After building, the exe should be located in the 'dist' folder.
    exe_files = [f for f in os.listdir(dist_dir) if f.endswith('.exe')]
    if exe_files:
        print("Found the following exe file(s) in the 'dist' folder:")
        for exe in exe_files:
            print(" -", exe)
    else:
        print("No exe file found in the 'dist' folder!")

if __name__ == "__main__":
    build_exe()
