# The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
from firebase_functions import firestore_fn, https_fn

# The Firebase Admin SDK to access Cloud Firestore.
from firebase_admin import initialize_app, firestore
import google.cloud.firestore
import cv2
import Equirec2Perspec as E2P

app = initialize_app()

if __name__ == '__main__':
    equ = E2P.Equirectangular('t.jpg')    # Load equirectangular image

    #
    # FOV unit is degree
    # theta is z-axis angle(right direction is positive, left direction is negative)
    # phi is y-axis angle(up direction positive, down direction negative)
    # height and width is output image dimension
    #
    # Specify parameters(FOV, theta, phi, height, width)
    img = equ.GetPerspective(120, 0, 0, 720, 1080)
    output = 'out.png'
    cv2.imwrite(output, img)
