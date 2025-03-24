from setuptools import setup
import os


def tree(src):
    return [
        (root, [os.path.join(root, f) for f in files])
        for (root, dirs, files) in os.walk(os.path.normpath(src))
    ]


APP = ['src/app.py']
DATA_FILES = tree('assets') + tree('static')

OPTIONS = {
    'strip': True,
    'argv_emulation': False,
    'includes': [
        'webview',
        'webview.platforms.cocoa',
        'objc',
        'Cocoa',
        'Quartz',
        'WebKit',
        'Security'
    ],
    'excludes': ['cefpython3', 'pythonnet'],
    'iconfile': 'favicon.icns',
    'plist': {
        'CFBundleName': 'PSIM to ACCE',
        'CFBundleShortVersionString': '1.0.0',
        'CFBundleVersion': '1.0.0',
        'CFBundleIdentifier': 'com.example.psimtoacce',
    }
}

setup(
    app=APP,
    name='PSIM to ACCE',
    data_files=DATA_FILES,
    options={'py2app': OPTIONS},
    setup_requires=['py2app'],
)
