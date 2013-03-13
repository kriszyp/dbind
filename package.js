var miniExcludes = {
		"dbind/Validator": 1,
		"dbind/README.md": 1,
		"dbind/package": 1
	},
	isTestRe = /\/tests\//;

var profile = {
	resourceTags: {
		test: function(filename, mid){
			return isTestRe.test(filename) || mid == "dbind/Validator";
		},

		miniExclude: function(filename, mid){
			return isTestRe.test(filename) || mid in miniExcludes;
		},

		amd: function(filename, mid){
			return /\.js$/.test(filename);
		}
	}
};