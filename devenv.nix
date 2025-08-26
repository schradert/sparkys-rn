{lib, pkgs, ...}: {
  android = {
    enable = true;
    reactNative.enable = true;
    buildTools.version = ["35.0.0"];
    ndk.version = ["27.1.12297006"];
    platforms.version = ["35"];
  };
  languages.nix.enable = true;
  languages = {
    typescript.enable = true;
    javascript.enable = true;
    javascript.bun.enable = true;
    javascript.bun.install.enable = true;
  };
  packages = with pkgs; lib.mkMerge [
    [claude-code google-cloud-sdk eas-cli]
    (lib.mkIf pkgs.stdenv.isDarwin [cocoapods fastlane])
  ];

  git-hooks.default_stages = [
    "pre-push"
    "manual"
  ];
  git-hooks.hooks = {
    # pre-commit builtins
    check-added-large-files.enable = true;
    check-case-conflicts.enable = true;
    check-executables-have-shebangs.enable = true;
    check-merge-conflicts.enable = true;
    check-symlinks.enable = true;
    check-vcs-permalinks.enable = true;
    end-of-file-fixer.enable = true;
    fix-byte-order-marker.enable = true;
    forbid-new-submodules.enable = true;
    mixed-line-endings.enable = true;
    no-commit-to-branch.enable = true;
    no-commit-to-branch.settings.branch = ["trunk"];
    trim-trailing-whitespace.enable = true;

    # third-party
    commitizen.enable = true;
    gitleaks = {
      enable = true;
      name = "gitleaks";
      description = "Gitleaks on entire project";
      entry = "${pkgs.gitleaks}/bin/gitleaks protect --redact";
    };
    lychee.enable = true;
    markdownlint.enable = true;
    markdownlint.settings.configuration.MD013.line_length = -1;
    mdsh.enable = true;
    tagref.enable = true;
    typos.enable = true;

    # nix
    alejandra.enable = true;
    deadnix.enable = true;
    statix.enable = true;
    statix.raw.args = [
      "--config"
      ((pkgs.formats.toml {}).generate "statix.toml" {
        disabled = [
          "unquoted_uri"
          "repeated_keys"
        ];
      })
    ];

    # javascript
    biome.enable = true;
  };
}
