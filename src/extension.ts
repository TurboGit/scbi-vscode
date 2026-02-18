import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function getPluginDir(): string {
    return path.join(os.homedir(), '.config', 'scbi');
}

export function activate(context: vscode.ExtensionContext) {

    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBar.text = "$(tools) SCBI Build";
    statusBar.command = "scbi.build";
    statusBar.tooltip = "Build SCBI target";
    statusBar.show();

    const buildCommand = vscode.commands.registerCommand('scbi.build', async () => {

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace open.");
            return;
        }

        const root = workspaceFolders[0].uri.fsPath;
        const plgdir = getPluginDir();
        const lscbi = path.join(root, ".vscode", "scbi");

        let env: string | undefined = undefined;

        const envFiles = ["default"].concat(fs.readdirSync(plgdir)
            .filter(file => file.startsWith(".env-"))
            .map(file => file.replace(".env-", "")));

        if (envFiles.length > 1) {
            env = await vscode.window.showQuickPick(envFiles, {
                placeHolder: "Select SCBI environment"
            });
        }

        let pluginFiles: string[] = [];
        let plugin: string | undefined = undefined;

        if (fs.existsSync(lscbi)) {
            fs.readFileSync(lscbi, 'utf8').split('\n').forEach(line => {
                if (line.trim() !== "") {
                    pluginFiles.push(line.trim());
                }
            });
        } else {
            // Find SCBI plugins (<letter>-*)
            pluginFiles = fs.readdirSync(plgdir)
                .filter(file => file.match("^[a-z]-"));
        };

        // Check for no plug-in or if a single one, select it,
        // otherwise show a quick pick

        if (pluginFiles.length === 0) {
            vscode.window.showErrorMessage("No SCBI plugins found.");
            return;
        } else if (pluginFiles.length === 1) {
            plugin = pluginFiles.at(0);
        } else {
            plugin = await vscode.window.showQuickPick(pluginFiles, {
                placeHolder: "Select SCBI plugin"
            });
        }

        if (!plugin) return;

        const pluginPath = path.join(plgdir, plugin);
        const content = fs.readFileSync(pluginPath, 'utf8');

        // Extract variants from function names
        const variantRegex = new RegExp(`${plugin}-(.*?)-(config|config-options|build|install|test)`, 'g');
        const variants = new Set<string>();
        let match;

        variants.add("none");

        while ((match = variantRegex.exec(content)) !== null) {
            variants.add(match[1]);
        }

        let variantList = Array.from(variants);
        let variant = "none";

        if (variantList.length != 0) {
           let variant = await vscode.window.showQuickPick(variantList, {
               placeHolder: "Select build variant"
           });
        }

        if (variant == "none") {
            variant = "";
        }
        else {
            variant = `/${variant}`;
        }

        let version = await await vscode.window.showInputBox({
            prompt: 'Select or enter a version',
            placeHolder: "Type or select...",
            value: '',
            valueSelection: [-1, -1],
            ignoreFocusOut: true,
        });

        if (version == "undefined") {
            version = "";
        } else {
            version = `:${version}`;
        }

        const target = `${plugin}${variant}${version}`;

        let envopt = "";
        if (env != "default") {
            envopt = ` --env=${env}`;
        }

        const task = new vscode.Task(
            { type: "scbi", target },
            vscode.TaskScope.Workspace,
            `SCBI ${target}`,
            "scbi",
            new vscode.ShellExecution(`scbi${envopt} --deps --safe ${target}`),
            "$scbi-gcc"
        );

        vscode.tasks.executeTask(task);
    });

    context.subscriptions.push(buildCommand, statusBar);
}

export function deactivate() {}
