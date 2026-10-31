# Getting Zombie Bash onto your iPhone and the App Store

This repo builds the iOS app on a Mac in the cloud (GitHub Actions), so you don't need your own Mac. The workflow is `.github/workflows/ios-testflight.yml`.

The path is: **Apple Developer account → app record → API key → GitHub secrets → run the workflow → TestFlight on your phone → submit for review.** Your own phone gets the app at step 7, before Apple reviews anything.

## 1. Join the Apple Developer Program
Go to https://developer.apple.com/programs/ and enroll with your Apple ID. It costs $99 a year. Approval for an individual usually takes a day or two.

## 2. Register the app's ID
In https://developer.apple.com/account → **Certificates, Identifiers & Profiles → Identifiers → +**:
- Type: **App IDs → App**
- Description: Zombie Bash
- Bundle ID (explicit): `com.spencer36m.zombiebash`

No extra capabilities are needed.

## 3. Create the app in App Store Connect
https://appstoreconnect.apple.com → **Apps → + → New App**
- Platform: iOS
- Name: see `listing.md` (names must be unique across the store)
- Primary language: English (U.S.)
- Bundle ID: the one from step 2
- SKU: anything, for example `zombiebash`

## 4. Create an App Store Connect API key
App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys → +**
- Name: GitHub
- Access: **Admin** (the cloud Mac needs this to create the signing certificate for you)

Download the `.p8` file. Apple only lets you download it once, so keep it safe. Note the **Key ID** shown next to the key and the **Issuer ID** at the top of the page.

Your **Team ID** is at https://developer.apple.com/account under Membership details.

## 5. Add the secrets to GitHub
In this repository on github.com: **Settings → Secrets and variables → Actions → New repository secret**. Add four:

| Name | Value |
| --- | --- |
| `APPLE_TEAM_ID` | your Team ID (10 characters) |
| `ASC_KEY_ID` | the Key ID |
| `ASC_ISSUER_ID` | the Issuer ID |
| `ASC_KEY_P8` | the whole text of the `.p8` file, including the BEGIN and END lines |

## 6. Build and upload
Merge this branch into your main branch, then on github.com open **Actions → iOS TestFlight → Run workflow**. It takes about 10–20 minutes. When it finishes, the summary says the build was uploaded.

GitHub's Mac runners are free for public repositories. Private repositories use your Actions minutes, and Mac minutes count 10×.

## 7. Install it on your phone with TestFlight
1. In App Store Connect, open your app → **TestFlight**. The build appears after Apple processes it (usually 5–30 minutes).
2. Under **Internal Testing**, create a group, add yourself with your Apple ID email and add the build.
3. On your iPhone, install **TestFlight** from the App Store, open the invite email, and tap **Install**.

Zombie Bash is now on your home screen like any other app. Every time you run the workflow again, TestFlight offers the update.

## 8. Host the privacy policy
Apple needs a privacy policy link. The game ships `privacy.html`. The easy way to host it is GitHub Pages: **Settings → Pages → Deploy from a branch → main → / (root)**. The link is then `https://spencer36m.github.io/build-a-cartoon-style-tower-defense-game-/privacy.html`. GitHub Pages also hosts the playable web version at the same address without the `privacy.html` part. On a free account, Pages needs the repository to be public.

## 9. Submit to the App Store
In App Store Connect, on the version page (1.0 Prepare for Submission):
- Fill in everything from `listing.md`, and upload the screenshots from `store/screenshots/`
- Pick the TestFlight build under **Build**
- App Privacy: **Data Not Collected**
- Answer the age rating questions
- Pricing: free (or a price)
- **Add for Review → Submit**

Review usually takes 1–3 days. The app already declares that it uses no special encryption, so export compliance is answered automatically.

## If the workflow fails
- **Missing secret**: one of the four secrets in step 5 is empty or misnamed.
- **No profiles / signing errors**: the API key must have the **Admin** role, and the bundle ID from step 2 must match exactly.
- **Xcode or SDK version errors**: Apple requires recent Xcode versions for uploads. The workflow picks the newest Xcode on the runner; if that's too old, change `runs-on: macos-15` to the newest `macos-*` runner label GitHub offers.
- **"The bundle version must be higher"**: the build number is the workflow's run number, so just run it again.

## Updating the game later
Change the game, push, and run the workflow again. Raise the version shown in the store by changing `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` (or ask Claude to).

## Regenerating screenshots
Serve the game with `python3 -m http.server 8765` in the repo folder, then run `node scripts/screenshots.cjs` (needs Playwright with Chromium).
