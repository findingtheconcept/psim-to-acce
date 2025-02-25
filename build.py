import os
import subprocess
import sys

project_dir = os.getcwd()
assets_dir = os.path.join(project_dir, 'assets')
static_dir = os.path.join(project_dir, 'static')
output_dir = os.path.join(project_dir, 'dist')

app_script = os.path.join(project_dir, 'src', 'app.py')

pyinstaller_command = [
    'pyinstaller',
    '--onefile',
    '--windowed'
    '--add-data', f'{assets_dir};assets',
    app_script
]

def run_command(command):
    try:
        print(f"Running command: {' '.join(command)}")
        subprocess.run(command, check=True)
        print("Build completed successfully!")
    except subprocess.CalledProcessError as e:
        print(f"Error during build: {e}")
        sys.exit(1)

def build():
    print(f"Building project from {app_script}...")
    run_command(pyinstaller_command)

if __name__ == "__main__":
    build()
