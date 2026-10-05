"""The Mapbox token for the overlay pages these scripts write.

The pages are opened from a file, with no URL, so the app's token - restricted
to the site's URLs - is refused there: they use MAPBOX_SCRIPTS_TOKEN (the
account's default public token, kept out of the app), and fall back to the
app's VITE_MAPBOX_ACCESS_TOKEN when it isn't set.
"""


def mapbox_token(env):
    return env.get('MAPBOX_SCRIPTS_TOKEN') or env.get('VITE_MAPBOX_ACCESS_TOKEN', '')
