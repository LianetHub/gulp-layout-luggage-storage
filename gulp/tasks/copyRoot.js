export const copyRoot = () => {
    return app.gulp.src(app.path.src.root)
        .pipe(app.gulp.dest(app.path.build.html))
        .pipe(app.plugins.browsersync.stream());
};
