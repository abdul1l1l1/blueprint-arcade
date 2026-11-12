# My Data and account ownership

## Downloading personal data

On your own profile, choose **Download My Data**. The authenticated endpoint is
`GET /api/auth/me/data`; it uses the logged-in session, ignores user IDs supplied
by a client, and returns a no-cache JSON attachment.

The export contains the account username, email, and role, profile fields, owned builds
(including image references and tags), and the user's own comments, ratings,
likes, and favorites. Interactions are exported by their build ID; data authored
by other users is not included. Password hashes, sessions, and other accounts'
private fields are never exported.

## Removing content

On your own profile, use **Delete** on one of your build cards to remove that
build. Its associated tags, comments, ratings, likes, and favorites are deleted
with it.

Account deletion can be requested from the site owner. This project does not
currently provide a self-service account deletion control.
