const gulp = require('gulp')
const eslint = require('gulp-eslint')
const mocha = require('gulp-mocha')

const running = {}
const watching = {}

const files = {
  gulp: 'gulpfile.js',
  src: 'lib/**/*.js',
  unit: 'test/unit/**/*.js',
  integration: 'test/integration/**/*.js'
}
files.all = Object.keys(files).map(k => files[k])

gulp.task('lint', () => {
  running.lint = files.all
  return gulp.src(running.lint)
    .pipe(eslint())
    .pipe(eslint.format())
})

gulp.task('test', () => {
  process.env.LOG_LEVEL = 'error'
  running.test = [files.src, files.unit]
  return gulp.src(files.unit)
    .pipe(mocha({reporter: 'spec'}))
})

gulp.task('integration', () => {
  process.env.LOG_LEVEL = 'error'
  running.integration = [files.src, files.integration]
  return gulp.src(files.integration)
    .pipe(mocha({reporter: 'spec'}))
})

gulp.task('watch', () => {
  return Object
    .keys(running)
    .filter(key => !watching[key])
    .forEach(key => {
      watching[key] = true
      return gulp.watch(running[key], [key])
    })
})
