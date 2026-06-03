import del from "del";
import zipPlugin from "gulp-zip";


function streamToPromise(stream) {
    return new Promise((resolve, reject) => {
        stream.on("error", reject);
        stream.on("end", resolve);
        stream.on("finish", resolve);
    });
}


const zipFileName = "landing-kamera-hraneniya.zip";

export const zip = () => {
    const buildDir = app.path.buildFolder.replace(/\\/g, "/");

    return del(`./${zipFileName}`, { force: true }).then(() => {
        const archive = app.gulp
            .src(`${buildDir}/**/*`, {
                base: buildDir,
                dot: true,
                allowEmpty: false,
            })
            .pipe(
                app.plugins.plumber(
                    app.plugins.notify.onError({
                        title: "ZIP",
                        message: "Error: <%= error.message %>",
                    })
                )
            )
            .pipe(zipPlugin(zipFileName))
            .pipe(app.gulp.dest("./"));

        return streamToPromise(archive);
    });
};