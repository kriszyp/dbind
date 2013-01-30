define([], function(){
	var undef,
		opts = {}.toString;
	function isArray(it){
		return typeof it == "array" || typeof it == "object" && it.splice;
	}
	function isFunction(it){
		return opts.call(it) === "[object Function]";
	}
	function on(node, event, callback){
		var addEventListener = !!node.addEventListener;
		node[addEventListener ? "addEventListener" : "attachEvent"]((addEventListener ? "" : "on") + event, callback, false);
		return {
			remove: function(){
				node[addEventListener ? "removeEventListener" : "detachEvent"](event, callback, false);
			}
		};
	}

	// A basic binding to value, our base class
	function Binding(value){
		if(arguments.length > 0){
			this.value = value;
			if(value){
				value._binding = this;
			}
		}
	}
	Binding.prototype = {
		then: function(callback){
			// get the value of this binding, notifying the callback of changes
			(this.callbacks = this.callbacks || []).push(callback);
			this.getValue(function(value){
				callback(value);
			});
		},
		getValue: function(callback){
			callback(this.value);
		},
		setValue: function(value, callback){
			var self = this;
			this.getValue(function(oldValue){
				if(oldValue !== value){
					self.value = value;
					if(callback){
						callback(value);
					}
				}
			});
		},
		get: function(key, callback){
			// use an existing child/property if it exists
			var child = this['_' + key] || (this['_' + key] = new Binding());
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
			var self = this;
			this.setValue(value, function(value){
				if(self.callbacks){
					for(var i = 0; i < self.callbacks.length; i++){
						self.callbacks[i](value);
					}
				}
			});
		},
		keys: function(callback){
			var self = this;
			if((this.source || {}).keys){
				this.source.keys(function(i){
					callback(i, self.get(i));
				});
			}
		},
		to: function(source, property){
			source = convertToBindable(source);
			if(property){
				source = source.get(property);
			}
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

	function ObjectBinding(object){
		this.object = object;
		if(object){
			object._binding = this;
		}
	}
	ObjectBinding.prototype = new Binding();
	ObjectBinding.prototype.get = function(key, callback){
		// use an existing child/property if it exists
		var prop = this.object[key],
			child = this['_' + key] || (this['_' + key] = typeof prop == "object" ? convertToBindable(prop) : new PropertyBinding(this.object, key));
		if(callback){
			return child.then(callback);
		}
		return child;
	};
	ObjectBinding.prototype.keys = function(callback){
		if((this.source || {}).keys){
			Binding.prototype.keys.apply(this, arguments);
			return;
		}
		for(var i in this.object){
			if(i.charAt(0) != '_'){
				callback(i, this.get(i));
			}
		}
	};

	function PropertyBinding(object, name){
		this.object = object;
		this.name = name;
	}
	PropertyBinding.prototype = new Binding();
	PropertyBinding.prototype.getValue = function(callback){
		callback(this.object[this.name]);
	};
	PropertyBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue !== value){
				self.object[self.name] = value;
				if(callback){
					callback(value);
				}
			}
		});
	};

	function StatefulBinding(){
		ObjectBinding.apply(this, arguments);
	}
	StatefulBinding.prototype = new ObjectBinding();
	StatefulBinding.prototype.get = function(key, callback){
		var child = this['_' + key] || (this['_' + key] = new StatefulPropertyBinding(this.object, key));
		if(callback){
			return child.then(callback);
		}
		return child;
	};

	function StatefulPropertyBinding(){
		PropertyBinding.apply(this, arguments);
	}
	StatefulPropertyBinding.prototype = new PropertyBinding();
	StatefulPropertyBinding.prototype.then = function(callback){
		PropertyBinding.prototype.then.apply(this, arguments);
		this.object.watch(this.name, function(name, oldValue, newValue){
			if(oldValue !== newValue){
				callback(newValue);
			}
		});
	};
	StatefulPropertyBinding.prototype.getValue = function(callback){
		callback(this.object.get(this.name));
	};
	StatefulPropertyBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue !== value){
				self.settingFromSelf = true;
				self.object.set(self.name, value); // Sets Stateful, and it causes then() callback to run
				self.settingFromSelf = false;
				if(callback){
					callback(value);
				}
			}
		});
	};
	StatefulPropertyBinding.prototype.to = function(){
		PropertyBinding.prototype.to.apply(this, arguments);
		var self = this;
		this.object.watch(this.name, function(name, oldValue, newValue){
			if(!self.settingFromSelf && oldValue !== newValue){
				self.source.put(newValue); // Send change not from binding to upstream source
			}
		});
		return this;
	};

	function WidgetBinding(){
		StatefulBinding.apply(this, arguments);
		this.name = "value";
	}
	WidgetBinding.prototype = new StatefulPropertyBinding();
	WidgetBinding.prototype.get = function(key){
		return (key == "id" ? Binding : StatefulBinding).prototype.get.apply(this, arguments);
	};

	function ElementBinding(){
		ObjectBinding.apply(this, arguments);
	}
	ElementBinding.prototype = new ObjectBinding();
	var checkable = {radio: 1, checkbox: 1};
	ElementBinding.prototype.getValue = function(callback){
		var element = this.object;
		if(this.container || element.tagName == "FORM"){
			Binding.prototype.getValue.apply(this, arguments);
		}else{
			callback(!("value" in element) ? element.innerText : element.type in checkable ? element.checked : typeof this.oldValue == "number" && !isNaN(element.value) ? +element.value : element.value);
		}
	};
	ElementBinding.prototype.setValue = function(value, callback){
		var element = this.object;
		if(this.container || element.tagName == "FORM"){
			Binding.prototype.setValue.apply(this, arguments);
		}else{
			var self = this;
			this.getValue(function(oldValue){
				if(oldValue !== value){
					if("value" in element){
						if(element.type == "radio"){
							element.checked = element.value == value;
						}else if(element.type == "checkbox"){
							element.checked = value;
						}else{
							element.value = value == null ? "" : value;
						}
					}else{
						element.innerText = value == null ? "" : value;
					}
					self.oldValue = value;
					if(callback){
						callback(value);
					}
				}
			});
		}
	};
	ElementBinding.prototype.get = function(key, callback){
		var attrib,
			element = this.object,
			special = this['_' + key] ||
				(/^\.collapsed$/i.test(key) ? new ElementCollapsedBinding(element) :
				/^\.hidden$/i.test(key) ? new ElementHiddenBinding(element) :
				key.charAt(0) == '.' ? new ElementClassBinding(element, key.substr(1)) :
				(attrib = (/^\[(.*)\]$/.exec(key) || [])[1]) ? new ElementAttributeBinding(element, attrib) :
				undef);
		if(!special && (this.container || element.tagName == "FORM")){
			return Binding.prototype.get.apply(this, arguments);
		}
		var child = child || (this['_' + key] = special || (element[key] === undef ? new Binding() : new PropertyBinding(element, key)));
		if(callback){
			return child.then(callback);
		}
		return child;
	};
	ElementBinding.prototype.then = function(callback){
		Binding.prototype.then.call(this, callback);
		var element = this.object,
			self = this;
		function onChange(){
			self.getValue(callback);
		}
		if(!this.container && element.tagName != "FORM"){
			on(element, "change", onChange);
			if(element.getAttribute("data-continuous")){
				on(element, "keyup", onChange);
			}
		}
	};
	ElementBinding.prototype.keys = function(){
		Binding.prototype.keys.apply(this, arguments); // Let source provide keys, not generaitng keys from object
	};
	var inputLike = {
		"INPUT":1,
		"SELECT":1,
		"TEXTAREA":1
	};
	ElementBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var element = this.object,
			self = this;
		if(this.container || element.tagName == "FORM"){
			function findInputs(tag){
				var inputs = element.getElementsByTagName(tag);
				for(var i = 0; i < inputs.length; i++){
					var input = inputs[i];
					if(input.name){
						bind(input, source.get(input.name));
					}
				}
			}
			findInputs("input");
			findInputs("select");
		}else if(element.tagName in inputLike){
			function onChange(){
				if(element.type != "radio" || element.checked){
					self.getValue(function(value){
						source.put(value);
					});
				}
			}
			on(element, "change", onChange);
			if(element.getAttribute("data-continuous")){
				on(element, "keyup", onChange);
			}
		}
		return this;
	};

	function ContainerBinding(){
		ElementBinding.apply(this, arguments);
		this.container = true;
	}
	ContainerBinding.prototype = new ElementBinding();

	function ElementCollapsedBinding(element){
		this.element = element;
	}
	ElementCollapsedBinding.prototype = new Binding();
	ElementCollapsedBinding.prototype.getValue = function(callback){
		callback(/^none$/i.test(this.element.style.display));
	};
	ElementCollapsedBinding.prototype.setValue = function(value, callback){
		var element = this.element;
		this.getValue(function(oldValue){
			if(oldValue ^ value){
				element.style.display = value ? "none" : "";
				if(callback){
					callback(value);
				}
			}
		});
	};

	function ElementHiddenBinding(element){
		this.element = element;
	}
	ElementHiddenBinding.prototype = new Binding();
	ElementHiddenBinding.prototype.getValue = function(callback){
		callback(/^hidden$/i.test(this.element.style.visibility));
	};
	ElementHiddenBinding.prototype.setValue = function(value, callback){
		var element = this.element;
		this.getValue(function(oldValue){
			if(oldValue ^ value){
				element.style.visibility = value ? "hidden" : "";
				if(callback){
					callback(value);
				}
			}
		});
	};

	function ElementAttributeBinding(){
		PropertyBinding.apply(this, arguments);
	}
	ElementAttributeBinding.prototype = new PropertyBinding();
	ElementAttributeBinding.prototype.getValue = function(callback){
		callback(this.object.getAttribute(this.name));
	};
	ElementAttributeBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue !== value){
				self.object.setAttribute(self.name, value == null ? "" : value);
				callback(value);
			}
		});
	};

	function ElementClassBinding(){
		PropertyBinding.apply(this, arguments);
	}
	ElementClassBinding.prototype = new PropertyBinding();
	ElementClassBinding.prototype.getValue = function(callback){
		var classes = this.object.className.split(/\s+/);
		for(var i = 0, l = classes.length; i < l; ++i){
			if(classes[i].replace(/^\s+/, "").replace(/\s+$/, "").toLowerCase() == this.name.toLowerCase()){
				callback(true);
				return;
			}
		}
		callback(false);
	};
	ElementClassBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue ^ value){
				var element = self.object;
				if(value){
					element.className += " " + self.name;
				}else{
					var classes = element.className.split(/\s+/);
					for(var i = classes.length - 1; i >= 0; --i){
						if(classes[i].replace(/^\s+/, "").replace(/\s+$/, "").toLowerCase() == self.name.toLowerCase()){
							classes.splice(i, 1);
						}
					}
					element.className = classes.join(" ");
				}
				if(callback){
					callback(value);
				}
			}
		});
	};

	function ArrayBinding(){
		ObjectBinding.apply(this, arguments);
	}
	ArrayBinding.prototype = new ObjectBinding();
	ArrayBinding.prototype.then = function(callback){
		(this.callbacks = this.callbacks || []).push(callback);
		var currentValues = [],
			updates = 0;
			length = this.object.length;
		// watch all the items, and return a resulting array whenever an item is updated
		for(var i = 0; i < length; i++){
			(function(i, source){
				when(source, function(value){
					currentValues[i] = value;
					updates++;
					if(updates >= length){
						callback(currentValues);
					}
				});
			})(i, this.object[i]);
		}
	};

	function FunctionBinding(func, reverseFunc){
		this.func = func;
		this.reverseFunc = reverseFunc;
	}
	FunctionBinding.prototype = {
		then: function(callback){
			if(callback){
				var func = this.func,
					self = this;
				return this.source.then(function(value){
					callback(isArray(value) ? func.apply(self, value) : func(value));
				});
			}
		},
		get: function(key){
			return this[key] || (this[key] = new Binding());
		},
		put: function(value){
			this.source.put(this.reverseFunc(value));
		},
		is: function(){},
		to: function(source){
			source = bind.apply(this, arguments);
			this.source = source;
			return this;
		},
		keys: function(){}
	};

	function convertToBindable(object){
		return object !== undef ?
			object._binding ||
				(object.get ?
					object.is ?
						object :
						object._blankGif ?
								new WidgetBinding(object) :
								new StatefulBinding(object) :
					object.nodeType ?
						new ElementBinding(object) :
						isFunction(object) ?
							new FunctionBinding(object) :
							isArray(object) ?
								new ArrayBinding(object) :
								typeof object == "object" ?
									new ObjectBinding(object) :
									new Binding(object))
			: new Binding(object);
	}

	function bind(to){
		// first convert target object to the bindable interface
		to = convertToBindable(to);
	
		for(var i = 1; i < arguments.length; i++){
			var arg = arguments[i];
			if(typeof arg == "object" || isFunction(arg)){
				arg = convertToBindable(arguments[i]);
				to.to(arg);
			}else{
				to = to.get(arg);
			}
		}
		return to;
	}

	bind.Element = ElementBinding;
	bind.Container = ContainerBinding;
	bind.Binding = Binding;

	function when(value, callback){
		if(value && value.then){
			return value.then(callback);
		}
		return callback(value);
	}
	bind.when = when;

	return bind;
});
