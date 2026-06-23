{
  config,
  lib,
  pkgs,
  ...
}: {
  android = {
    enable = true;
    reactNative.enable = true;
    buildTools.version = ["36.0.0"];
    ndk.version = ["27.1.12297006"];
    platforms.version = ["36"];
  };
  languages.nix.enable = true;
  languages = {
    typescript.enable = true;
    javascript.enable = true;
    javascript.bun.enable = true;
    javascript.bun.install.enable = true;
  };
  packages = with pkgs;
    lib.mkMerge [
      # claude-code: AI CLI; gcloud/eas: release tooling;
      # osv-scanner/vulnix/gitleaks: dependency/toolchain CVE + secret scanning (see `security`);
      # nixd/alejandra: Nix LSP + formatter for the Zed/Helix integration.
      [claude-code google-cloud-sdk eas-cli osv-scanner vulnix gitleaks nixd alejandra]
      (lib.mkIf pkgs.stdenv.isDarwin [cocoapods fastlane])
    ];

  # One-command flows for rapid dev / release. Run by name inside the shell
  # (e.g. `bootstrap`, `security`); listed in enterShell below. Everyday JS
  # tasks live in package.json scripts (`bun run dev|lint|test|...`).
  scripts = {
    bootstrap = {
      description = "Install deps, generate typed-route types, run expo-doctor";
      exec = ''
        set -e
        echo "==> bun install"
        bun install
        echo "==> Generating typed-route types (brief expo start)"
        APP_VARIANT=development timeout 75 bunx --bun expo start --offline >/dev/null 2>&1 || true
        echo "==> expo-doctor"
        bunx --bun expo-doctor || true
      '';
    };
    security = {
      description = "Scan JS deps + Nix toolchain for CVEs and secrets";
      exec = ''
        echo "==> bun audit (JS dependency CVEs)"
        bun audit || true
        echo "==> osv-scanner (lockfile CVEs)"
        osv-scanner scan --lockfile=bun.lock 2>/dev/null || osv-scanner --lockfile=bun.lock || true
        echo "==> vulnix (Nix toolchain CVEs)"
        vulnix --gc-roots || true
        echo "==> gitleaks (secret scan, full history)"
        gitleaks detect --redact --no-banner || true
      '';
    };
    doctor = {
      description = "Run expo-doctor";
      exec = "bunx --bun expo-doctor";
    };
    build-dev = {
      description = "EAS cloud build — development variant (all platforms)";
      exec = "eas build --profile development --platform all";
    };
    build-preview = {
      description = "EAS cloud build — preview variant (all platforms)";
      exec = "eas build --profile preview --platform all";
    };
    build-prod = {
      description = "EAS cloud build — production variant (all platforms)";
      exec = "eas build --profile production --platform all";
    };
    build-dev-local = {
      description = "EAS local build — development variant (android)";
      exec = "eas build --profile development --platform android --local";
    };
    eas-update = {
      description = "Publish an EAS Update (OTA)";
      exec = "eas update";
    };
  };

  # `devenv up` starts the Metro dev server.
  processes.expo.exec = "APP_VARIANT=development bunx expo start";

  enterShell = ''
    # Put the JS dev-group bins (biome, tsc, eslint, typescript-language-server)
    # on PATH so git-hooks and the Zed/Helix LSPs use the versions pinned in
    # package.json devDependencies — not Nix or ad-hoc bunx downloads.
    export PATH="$DEVENV_ROOT/node_modules/.bin:$PATH"
    echo ""
    echo "sparkys-rn — dev shell ready. Common commands:"
    echo "  bun run dev | dev:preview | dev:prod    start Metro (variant)"
    echo "  bun run typecheck | lint | format | check   quality gates"
    echo "  bun run test | test:watch | test:coverage   tests"
    echo "  bun run docs                                 API docs (typedoc)"
    echo "  bootstrap         install + gen types + doctor"
    echo "  security          CVE + secret scan"
    echo "  doctor            expo-doctor"
    echo "  build-dev|preview|prod[-local]   EAS builds   •   eas-update   OTA"
    echo "  devenv up         run the Metro process"
    echo ""
  '';

  # Editor integration (canivete pattern): devenv generates per-editor LSP +
  # formatter config so Zed and Helix share one toolchain. Launch the editor from
  # inside the devenv shell so node_modules/.bin (biome, typescript-language-server)
  # is on PATH. TypeScript intelligence: vtsls in Zed (built-in), the
  # typescript-language-server devDependency in Helix; Biome formats + organizes
  # imports in both; nixd + alejandra handle Nix.
  files.".zed/settings.json".json = {
    # Load the project's direnv (devenv) environment so Zed's language servers
    # resolve from the toolchain (node_modules/.bin, nixd). Requires direnv
    # installed and `.envrc` allowed (run `direnv allow` once).
    load_direnv = "direct";
    # Zed needs the Biome + Nix extensions for those language servers (vtsls is
    # built in); auto-install them so the LSPs work out of the box.
    auto_install_extensions = {
      biome = true;
      nix = true;
    };
    lsp = {
      biome.settings.require_config_file = true;
      nixd = {};
      vtsls.settings.typescript.tsdk = "node_modules/typescript/lib";
    };
    languages = let
      ts = {
        language_servers = ["vtsls" "biome" "..."];
        formatter.language_server.name = "biome";
        code_actions_on_format."source.organizeImports.biome" = true;
        format_on_save = "on";
      };
      json = {
        language_servers = ["biome" "..."];
        formatter.language_server.name = "biome";
        format_on_save = "on";
      };
    in {
      TypeScript = ts;
      TSX = ts;
      JavaScript = ts;
      JSX = ts;
      JSON = json;
      JSONC = json;
      Nix = {
        language_servers = ["nixd"];
        formatter.external = {
          command = "alejandra";
          arguments = [];
        };
        format_on_save = "on";
      };
    };
  };
  files.".helix/languages.toml".toml = {
    language-server = {
      typescript-language-server = {
        command = "typescript-language-server";
        args = ["--stdio"];
      };
      biome = {
        command = "biome";
        args = ["lsp-proxy"];
      };
      nixd.command = "nixd";
    };
    language = let
      # ts-language-server for intelligence, Biome for formatting.
      tsServers = [
        {
          name = "typescript-language-server";
          except-features = ["format"];
        }
        {
          name = "biome";
          only-features = ["format"];
        }
      ];
      tsLang = name: {
        inherit name;
        language-servers = tsServers;
        auto-format = true;
      };
    in [
      (tsLang "typescript")
      (tsLang "tsx")
      (tsLang "javascript")
      (tsLang "jsx")
      {
        name = "json";
        language-servers = [
          {
            name = "biome";
            only-features = ["format" "diagnostics"];
          }
        ];
        auto-format = true;
      }
      {
        name = "nix";
        language-servers = ["nixd"];
        formatter.command = "alejandra";
        auto-format = true;
      }
    ];
  };

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
    # eas.json holds opaque Google Sheet IDs whose substrings read as typos to
    # the spell-checker; skip the file rather than chase each false positive.
    typos.excludes = ["^eas\\.json$"];

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

    # javascript — Biome (format + lint) from package.json devDependencies, not
    # Nix: the hook references the language toolchain's dev group via
    # node_modules/.bin (the same way a Python project references its uv venv).
    biome = {
      enable = true;
      name = "biome";
      description = "Biome — format + lint (devDependency)";
      entry = "${config.devenv.root}/node_modules/.bin/biome check";
      files = "\\.(jsx?|tsx?|jsonc?)$";
      pass_filenames = false;
    };

    # typescript / eslint / tests — heavier gates, run at pre-push (matching
    # default_stages). pass_filenames = false so they check the whole project.
    tsc = {
      enable = true;
      name = "tsc";
      description = "TypeScript type-check (tsc --noEmit)";
      entry = "${config.devenv.root}/node_modules/.bin/tsc --noEmit";
      files = "\\.(ts|tsx)$";
      pass_filenames = false;
    };
    eslint = {
      enable = true;
      name = "eslint";
      description = "ESLint — React/Expo semantics";
      entry = "${config.devenv.root}/node_modules/.bin/eslint .";
      files = "\\.(js|jsx|ts|tsx)$";
      pass_filenames = false;
    };
    jest = {
      enable = true;
      name = "jest";
      description = "Jest unit tests";
      # Must run under Node, not Bun — `bun`/`bunx --bun` breaks jest-runtime
      # ("Attempted to assign to readonly property"). The node-shebang bin is safe.
      entry = "${config.devenv.root}/node_modules/.bin/jest --bail --passWithNoTests";
      files = "\\.(ts|tsx)$";
      pass_filenames = false;
    };

    # On-demand checks: `pre-commit run --hook-stage manual <id>`.
    expo-doctor = {
      enable = true;
      name = "expo-doctor";
      description = "Expo project health check";
      entry = "bunx --bun expo-doctor";
      pass_filenames = false;
      stages = ["manual"];
    };
    security-scan = {
      enable = true;
      name = "security-scan";
      description = "CVE + secret scan (bun audit, osv-scanner, vulnix, gitleaks)";
      entry = "security";
      pass_filenames = false;
      stages = ["manual"];
    };
  };
}
