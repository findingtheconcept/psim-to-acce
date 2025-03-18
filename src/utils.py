import os


def get_app_folder():
    home = os.path.expanduser("~")
    folder = os.path.join(home, "psim_acce_history")
    if not os.path.exists(folder):
        os.makedirs(folder, exist_ok=True)
    return folder
