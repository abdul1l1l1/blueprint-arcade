# Settings and account ownership

## Downloading personal data

On **Settings**, choose **Download My Data**. The authenticated endpoint is
`GET /api/auth/me/data`; it uses the logged-in session, ignores user IDs supplied
by a client, and returns a no-cache JSON attachment.

The export contains the account username, email, and role, profile fields, owned builds
(including image references and tags), and the user's own comments, ratings,
likes, and favorites. Interactions are exported by their build ID; data authored
by other users is not included. Password hashes, sessions, and other accounts'
private fields are never exported.

## Removing content

On **Settings**, open **My Profile** to manage your builds. Use **Delete** on
one of your build cards to remove that build. Its associated tags, comments,
ratings, likes, and favorites are deleted with it.

## Deleting your account

On **Settings**, enter your current password, type `DELETE`, and confirm the
warning. This permanently removes only the signed-in account, its profile,
builds, related social activity, sessions, and uploaded image objects. The
operation cannot be undone. A missing or incorrect password, missing typed
confirmation, or cancelled browser confirmation does not delete the account.
If another builder's saved post references one of your uploaded images, account
deletion is blocked until that post removes the reference so their content is
not broken.
After a recent image upload, wait 11 minutes for its temporary transfer link to
expire before deleting the account.

## Build image access

Uploaded images remain in private App Storage. An image is served only when it
is validated, consented, and either belongs to the signed-in uploader or is
referenced by a saved public build. Build image references are not direct
storage URLs.
