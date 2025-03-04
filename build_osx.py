from setuptools import setup
import os


def tree(src):
    return [
        (root, [os.path.join(root, f) for f in files])
        for (root, dirs, files) in os.walk(os.path.normpath(src))
    ]


APP = ['src/app.py']  # The main Python entry point

DATA_FILES = tree('assets') + tree('static')
OPTIONS = {
    'strip': True,
    'argv_emulation': False,
    'includes': ['webview']
    # 'iconfile': 'icon.icns'  # if you have an icon
}

setup(
    app=APP,
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
