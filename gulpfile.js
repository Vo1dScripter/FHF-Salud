const { src, dest, watch, series } = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const plumber = require('gulp-plumber');
const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');
const postcss = require('gulp-postcss');
const sourcemaps = require('gulp-sourcemaps');
const cleanCSS = require('gulp-clean-css');

// ✅ Compilar y minificar SASS
function css() {
  return src('src/scss/**/*.scss')
    .pipe(sourcemaps.init())
    .pipe(plumber())
    .pipe(sass().on('error', sass.logError))
    .pipe(postcss([autoprefixer(), cssnano()]))
    .pipe(cleanCSS({ level: 2 }))
    .pipe(sourcemaps.write('.'))
    .pipe(dest('src/styles'))
    .on('end', () => console.log('✅ CSS compilado y optimizado.'));
}

// 🔁 Watch para desarrollo
function dev() {
  watch('src/scss/**/*.scss', css);
}

// 🚀 Exportaciones
exports.css = css;
exports.dev = series(css, dev);

// npm install --save-dev gulp gulp-sass sass gulp-plumber autoprefixer cssnano gulp-postcss gulp-sourcemaps gulp-clean-css concurrently
