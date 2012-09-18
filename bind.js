define([], function(){
	/*function StatefulBinding(stateful){
		this.stateful = stateful;
		stateful._binding = this;
	}
	StatefulBinding.prototype = {
		then: function(callback){
			callback();
		},
		get: function(key, callback){
			if(!callback){
				if(key.call){
					key(this.stateful.get('value'));
				}else{
					return this.stateful.get(key);
				}
			}else{
				callback(this.stateful.get(key));
			}
		},
		put: function(){},
		is: function(){}
	};*/
	function Binding(value){
		this.value= value;
		if(value){
			value._binding = this;
		}
	}
	Binding.prototype = {
		then: function(callback){
			(this.callbacks || (this.callbacks = [])).push(callback); 
			callback(this.getValue());
		},
		getValue: function(){
			return this.value;
		},
		get: function(key, callback){
			var child = this['_' + key] || (this.source ?
				this.source.get(key) :
				(this['_' + key] = this.value && typeof this.value == "object" ? 
					new PropertyBinding(this.value, key) :
					new Binding()));
			if(callback){
				return child.then(callback);
			}
			return child;
		},
		put: function(value){
			if(this.source){
				this.source.put(value);
			}
			this.is(value);
		},
		is: function(value){
			this.value = value;
			if(this.callbacks){
				for(var i = 0; i < this.callbacks.length; i++){
					this.callbacks[i](value);
				}
			}
		},
		keys: function(callback){
			var source = this.source || this;
			for(var i in source){
				if(i.charAt(0) == '_'){
					i = i.slice(1);
					callback(i, source.get(i));
				}			}
		},
		to: function(source){
			source = convertToBindable(source);
			var self = this;
			this.source = source;
			source.then(function(value){
				self.is(value);
			});
			for(var i in this){
				if(i.charAt(0) == '_'){
					i = i.slice(1);
					var child = self.get(i);
					var sourceChild = source.get(i);
					if(child != sourceChild){
						child.to(sourceChild);
					}
				}
			}
			source.keys(function(i, sourceChild){
				if(!(('_' + i) in self)){
					var child = self.get(i);
					if(child != sourceChild){
						child.to(sourceChild);
					}
				}
			});
			return this;
		}
	};
	function ElementBinding(element, container){
		this.element= element;
		this.container = container;
		element._binding = this;
	}
	function ContainerBinding(element){
		return new ElementBinding(element, true);
	}
	ElementBinding.prototype = new Binding({});
	ElementBinding.prototype.is = function(value){
		if(this.container || this.element.tagName == "FORM"){
			return Binding.prototype.is.call(this, value);
		};
		if("value" in this.element){
			this.element.value = value || "";
		}else{
			this.element.innerText = value || "";
		}
	};
	ElementBinding.prototype.to = function(source){
		Binding.prototype.to.call(this, source);
		var element = this.element;
		if(element.tagName == "FORM"){
			var inputs = element.getElementsByTagName("input");
			for(var i = 0; i < inputs.length; i++){
				var input = inputs[i];
				if(input.name){
					bind(input, this.get(input.name));
				}
			}
		}else if(element.tagName == "INPUT"){
			element.onchange = function(){
				var value = element.value;
				source.put(typeof source.getValue() == "number" ? +value : value);
			};
		}
		return this;
	}
	ElementBinding.prototype.then = function(callback){
		var element = this.element;
		if(this.container){
			return Binding.prototype.then.call(this, callback);
		}
		if("value" in element){
			callback(element.value);
			element.onchange = function(){
				callback(element.value);
			};
		}else{
			callback(element.innerText);
		}
	};
	function PropertyBinding(object, name){
		this.object = object;
		this.name = name;
	}
	PropertyBinding.prototype = new Binding;
	PropertyBinding.prototype.getValue = function(){
		return this.object[this.name];
	};
	PropertyBinding.prototype.put = function(value){
		this.object[this.name] = value;
		this.is(value);
	}
	function FunctionBinding(func, reverseFunc){
		this.func = func;
		this.reverseFunc = reverseFunc;
	}
	FunctionBinding.prototype = {
		then: function(callback){
			if(callback){
				var func = this.func;
				return this.source.then(function(value){
					callback(func(value));
				});
			}
		},
		get: function(key){
			return this[key] || (this[key] = new Binding('None'));
		},
		put: function(value){
			this.source.put(this.reverseFunc(value));
		},
		is: function(){},
		to: function(source){
			source = convertToBindable(source);
			this.source = source;
			return this;
		},
		keys: function(){}
	} 
	function convertToBindable(object){
		return object ?
			object._binding || 
				(object.get ? 
					object.is ?
				 		object :
					 	new StatefulBinding(object) :
					object.nodeType ?
						new ElementBinding(object) :
						typeof object == "function" ?
							new FunctionBinding(object) :
				 			new Binding(object))
			: new Binding(object);
	}
	function bind(to){
		// first convert target object to the bindable interface
		to = convertToBindable(to);
	
		for(var i = 1; i < arguments.length; i++){
			var arg = convertToBindable(arguments[i]);
			to.to(arg);
		}
		return to;
	};
	var nativeWatch = Object.prototype.watch;
	function get(object, key, callback){
		if(key.call){
			// get(object ,callback) form
			if(object.get){
				if(object.get.binding){
					object.get(key);
				}else{
					key(object.get('value'));
				}
			}else{
				key(object);
			}
		}else{
			var value;
			if(object.get){
				if(object.get.binding){
					object.get(key, callback);
				}else{
					key(object.get('value'));
					if(object.watch === nativeWatch){
						object.watch('value', key);
					}
				}
			}else{
				return new PropertyBinding(object, key);
			}
		}
	};
	bind.get = get;
	bind.Element = ElementBinding;
	bind.Container = ContainerBinding;
	bind.Binding = Binding;
	return bind;
});