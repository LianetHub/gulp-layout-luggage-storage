import fileinclude from "gulp-file-include";
import webpHtmlNosvg from "gulp-webp-html-nosvg";
import versionNumber from "gulp-version-number";
import htmlBeautify from "gulp-html-beautify";
import through2 from "through2";
import cheerio from "cheerio";

function addWebpSources() {
	return through2.obj(function (file, _, cb) {
		if (file.isBuffer()) {
			const $ = cheerio.load(file.contents.toString());
			$("picture").each(function () {
				const picture = $(this);
				const img = picture.find("img");
				const imgSrc = img.attr("src");

				// Добавляем webp источники для существующих тегов <source>
				const sources = picture.find("source");
				sources.each(function () {
					const source = $(this);
					const media = source.attr("media");
					const srcset = source.attr("srcset");
					if (srcset && !source.attr("type")) {
						const webpSource = `<source type="image/webp" media="${media}" srcset="${srcset.replace(".jpg", ".webp")}">`;
						source.before(webpSource);
					}
				});

				// Добавляем webp источник для тега <img>
				if (imgSrc) {
					const webpSource = `<source type="image/webp" srcset="${imgSrc.replace(".jpg", ".webp")}">`;
					img.before(webpSource);
				}
			});
			file.contents = Buffer.from($.html());
		}
		cb(null, file);
	});
}

export const html = () => {
	return app.gulp
		.src(app.path.src.html)
		.pipe(
			app.plugins.if(
				app.isBuild,
				htmlBeautify({
					indent_size: 4,
					indent_with_tabs: true,
					preserve_newlines: false,
					max_preserve_newlines: 0,
					wrap_line_length: 0,
					end_with_newline: true,
				}),
			),
		)
		.pipe(
			app.plugins.plumber(
				app.plugins.notify.onError({
					title: "HTML",
					message: "Error: <%= error.message %>",
				}),
			),
		)
		.pipe(fileinclude())
		.pipe(app.plugins.replace(/@img\//g, "img/"))
		.pipe(
			app.plugins.if(
				app.isBuild,
				versionNumber({
					value: "%DT%",
					append: {
						key: "_v",
						cover: 0,
						to: ["css", "js"],
					},
					output: {
						file: "gulp/version.json",
					},
				}),
			),
		)
		.pipe(
			app.plugins.if(
				app.isBuild,
				htmlBeautify({
					indent_size: 4,
					indent_with_tabs: true,
					preserve_newlines: false,
					max_preserve_newlines: 0,
					wrap_line_length: 0,
					end_with_newline: true,
				}),
			),
		)
		.pipe(app.gulp.dest(app.path.build.html))
		.pipe(app.plugins.browsersync.stream());
};
