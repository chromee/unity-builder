import { exec } from '@actions/exec';
import ImageEnvironmentFactory from './image-environment-factory';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import { userInfo } from 'os';

class Docker {
  static async run(image, parameters, silent = false) {
    let runCommand = '';
    switch (process.platform) {
      case 'linux':
        runCommand = this.getLinuxCommand(image, parameters);
        break;
      case 'win32':
        runCommand = this.getWindowsCommand(image, parameters);
    }
    await exec(runCommand, undefined, { silent });
  }

  static getLinuxCommand(image, parameters): string {
    const { workspace, actionFolder, runnerTempPath, sshAgent, gitPrivateToken } = parameters;

    const githubHome = path.join(runnerTempPath, '_github_home');
    if (!existsSync(githubHome)) mkdirSync(githubHome);
    const githubWorkflow = path.join(runnerTempPath, '_github_workflow');
    if (!existsSync(githubWorkflow)) mkdirSync(githubWorkflow);
    const homedir = userInfo().homedir;
    let keys = '';
    for (const file of readdirSync(`${homedir}/.ssh`)) {
      if (!file.startsWith('key-')) continue;
      keys += `--volume ${homedir}/.ssh/${file}:${homedir}/.ssh/${file}:ro `;
    }

    return `docker run \
            --workdir /github/workspace \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
            --env UNITY_SERIAL \
            --env GITHUB_WORKSPACE=/github/workspace \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            ${sshAgent ? '--env SSH_AUTH_SOCK=/ssh-agent' : ''} \
            --volume "${githubHome}":"/root:z" \
            --volume "${githubWorkflow}":"/github/workflow:z" \
            --volume "${workspace}":"/github/workspace:z" \
            --volume "${actionFolder}/default-build-script:/UnityBuilderAction:z" \
            --volume "${actionFolder}/platforms/ubuntu/steps:/steps:z" \
            --volume "${actionFolder}/platforms/ubuntu/entrypoint.sh:/entrypoint.sh:z" \
            ${sshAgent ? `--volume ${sshAgent}:/ssh-agent` : ''} \
            ${sshAgent ? `--volume ${homedir}/.ssh/config:/root/.ssh/config:ro` : ''} \
            ${sshAgent ? `--volume ${homedir}/.ssh/known_hosts:/root/.ssh/known_hosts:ro` : ''} \
            ${sshAgent ? keys : ''} \
            ${sshAgent ? `--volume ${homedir}/.gitconfig:/root/.gitconfig:ro` : ''} \
            ${image} \
            /bin/bash -c /entrypoint.sh`;
  }

  static getWindowsCommand(image: any, parameters: any): string {
    const { workspace, actionFolder, unitySerial, gitPrivateToken } = parameters;

    return `docker run \
            --workdir /github/workspace \
            --rm \
            ${ImageEnvironmentFactory.getEnvVarString(parameters)} \
            --env UNITY_SERIAL="${unitySerial}" \
            --env GITHUB_WORKSPACE=c:/github/workspace \
            ${gitPrivateToken ? `--env GIT_PRIVATE_TOKEN="${gitPrivateToken}"` : ''} \
            --volume "${workspace}":"c:/github/workspace" \
            --volume "c:/regkeys":"c:/regkeys" \
            --volume "C:/Program Files (x86)/Microsoft Visual Studio":"C:/Program Files (x86)/Microsoft Visual Studio" \
            --volume "C:/Program Files (x86)/Windows Kits":"C:/Program Files (x86)/Windows Kits" \
            --volume "C:/ProgramData/Microsoft/VisualStudio":"C:/ProgramData/Microsoft/VisualStudio" \
            --volume "${actionFolder}/default-build-script":"c:/UnityBuilderAction" \
            --volume "${actionFolder}/platforms/windows":"c:/steps" \
            --volume "${actionFolder}/BlankProject":"c:/BlankProject" \
            ${image} \
            powershell c:/steps/entrypoint.ps1`;
  }
}

export default Docker;
