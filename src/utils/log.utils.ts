import chalk from "chalk";

export class LogUtils {
    public static LogRoute(name: string) {
        console.log(chalk.gray(`Initializing route: ${name}`));
    }
}