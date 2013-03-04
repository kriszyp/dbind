define(['json-schema/lib/validate', './bind'], function(validate, bind){
	var Binding = bind.Binding;

	function ValidatorBinding(){
		Binding.apply(this, arguments);
	}
	ValidatorBinding.prototype = new Binding();
	ValidatorBinding.prototype.create = function(schema){
		this.schema = schema;
		Binding.prototype.create.call(this);
	};
	ValidatorBinding.prototype.put = function(value){
		var results = validate(value, this.schema);
		if(results.valid){
			this.source.put(value);
			this.get("error").is("");
		}else{
			var errors = [];
			for(var i = 0; i < results.errors.length; i++){
				errors.push(results.errors[i].property + results.errors[i].message);
			}
			this.get("error").is(errors);
		}
	};
	return ValidatorBinding;
});