"""
Active la signature "release" dans android/app/build.gradle.
Ce script est exécuté dans le workflow GitHub Actions après `expo prebuild`.
Il ajoute un bloc de signature release qui lit les propriétés du keystore
stockées dans android/gradle.properties (elles-mêmes fournies par les
secrets GitHub).
"""

import re

BUILD_GRADLE = "android/app/build.gradle"

SIGNING_BLOCKS = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file(project."GALLERY_STORE_FILE")
            storePassword project."GALLERY_STORE_PASSWORD"
            keyAlias project."GALLERY_KEY_ALIAS"
            keyPassword project."GALLERY_KEY_PASSWORD"
        }
    }"""


def main() -> None:
    with open(BUILD_GRADLE, "r", encoding="utf-8") as f:
        content = f.read()

    # Remplace le bloc signingConfigs existant par un bloc incluant release.
    content = re.sub(
        r"signingConfigs \{.*?\n    \}",
        SIGNING_BLOCKS,
        content,
        flags=re.DOTALL,
    )

    # Dans le buildType "release", utilise la signature release à la place
    # de la signature debug. On cible uniquement le bloc release des
    # buildTypes (précédé de son commentaire "Caution!") pour éviter de
    # toucher au bloc debug ni au bloc release de signingConfigs.
    content = re.sub(
        r"(release \{\s*(?://[^\n]*\n\s*)*)signingConfig signingConfigs\.debug",
        r"\1signingConfig signingConfigs.release",
        content,
        count=1,
    )

    with open(BUILD_GRADLE, "w", encoding="utf-8") as f:
        f.write(content)

    print("build.gradle patched pour la signature release")


if __name__ == "__main__":
    main()