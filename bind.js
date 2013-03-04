define(["./Observable"], function(Observable){
	var undef,
		opts = {}.toString;

	function isArray(it){
		return typeof it == "array" || typeof it == "object" && it.splice;
	}
	isArray = Array.isArray || isArray;
	function isFunction(it){
		return opts.call(it) === "[object Function]";
	}
	function isPrimitiveLike(it){
		return !isArray(it) && !isFunction(it) && typeof it != "object";
	}
	function on(node, event, callback){
		var addEventListener = !!node.addEventListener;
		node[addEventListener ? "addEventListener" : "attachEvent"]((addEventListener ? "" : "on") + event, callback, false);
		var h = {
			remove: function(){
				h && node[addEventListener ? "removeEventListener" : "detachEvent"](event, callback, false);
				return h = null;
			}
		};
		return h;
	}

	function around(target, methodName, advice){
		var original = target[methodName],
			dispatcher = target[methodName] = function(){
				if(advice){
					advice.call(target, original, arguments);
				}
			};
		dispatcher.reconnect = function(to){
			if(original = to){
				to.next = dispatcher;
			}
		};
		if(original){
			original.next = dispatcher;
		}
		return {
			remove: function(){
				var next = (dispatcher || {}).next;
				if(next){
					next.reconnect(original);
				}else if(target[methodName] == dispatcher && (target[methodName] = original)){
					original.next = next;
				}
				return target = advice = original = dispatcher = null;
			}
		};
	}

	function isContainer(element){
		// Returns whether an element has a binding working as a container
		return (element || {})._binding && (/^(body|form)$/i.test(element.tagName) || element._binding.using(bind.container));
	}

	function isUserChangeable(binding){
		var element = binding.object,
			name = binding.name,
			tagName = element.tagName;
		return !binding.name ? !isContainer(element) :
			tagName == "TEXTAREA" ? /^(innerText|value)$/.test(name) :
			tagName == "CHECKBOX" ? /^(checked|value)$/.test(name) :
			/^(INPUT|SELECT)$/.test(tagName) ? name == "value" :
			false;
	}

	function createOwnFunc(method){
		function own(){
			for(var i = 0, l = arguments.length; i < l; ++i){
				(function(h){
					var destroyMethodName = typeof h != "object" ? "" :
						method && (method in h) ? method :
						"destroyRecursive" in h ? "destroyRecursive" :
						"destroy" in h ? "destroy" :
						"cancel" in h ? "cancel" :
						"remove" in h ? "remove" :
						"";
					if(destroyMethodName){
						var odh = around(this, method || "destroy", function(original, args){
							h[destroyMethodName]();
							original.apply(this, args);
						}), hdh = around(h, destroyMethodName, function(original, args){
							original.apply(this, args);
							odh.remove();
							hdh.remove();
						});
					}
				}).call(this, arguments[i]);
			}
			return arguments;
		}
		return own;
	}

	// A basic binding to value, our base class
	function Binding(){
		this.create.apply(this, arguments);
	}
	Binding.prototype = {
		create: function(value){
			if(arguments.length > 0){
				this.value = value;
				if(value){
					value._binding = this;
					this.own({
						remove: function(){
							(value || {})._binding = null;
						}
					}, value);
				}
			}
		},
		canuse: function(option){
			return option in bind;
		},
		use: function(){
			this.options = this.options || {};
			for(var i = 0, l = arguments.length; i < l; ++i){
				var option = arguments[i];
				if(this.canuse(option)){ // Ignore non-valid option
					// If this is the last arg, or the next arg is a valid option, set true. Otherwise set the next arg as the option value
					this.options[option] = i + 1 >= l || this.canuse(arguments[i + 1]) || arguments[++i];
				}
			}
			return this;
		},
		using: function(option){
			return (this.options || {})[option];
		},
		then: function(callback, errback){
			var observable = this.observable;
			if(!observable){
				observable = this.observable = new Observable();
				this.getValue(Observable.makeSignaler(observable));
			}
			return this.own(observable.then(callback, errback))[0];
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
			var child = this['_' + key] || (this['_' + key] = this.own(new Binding())[0]);
			if(callback){
				return child.then(callback);
			}
			return child;
		},
		set: function(key, child, callback){
			this['_' + key] = child = this.own(convertToBindable(child))[0];
			if(callback){
				return child.then(callback);
			}
			return child;
		},
		put: function(value){
			var source = this.source;
			if((source || {}).put){
				source.put(value);
			}else if((source || {}).resolve){
				source.resolve(value);
			}
			this.is(value);
		},
		is: function(value){
			this.setValue(value, Observable.makeSignaler(this.observable));
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
			this.reset();
			source = convertToBindable(source);
			if(property){
				source = source.get(property);
			}
			var self = this;
			this.source = source;
			this.resettable(source.then(function(value){
				self.is(value);
			}));
			return this.enumerate();
		},
		enumerate: function(){
			var self = this,
				source = this.source;
			if(source.get){
				for(var i in this){
					if(i.charAt(0) == '_' && (i = i.slice(1))){
						var child = this.get(i),
							sourceChild = source.get(i);
						if(child != sourceChild){
							this.resettable(child.to(sourceChild));
						}
					}
				}
			}
			source.keys && source.keys(function(i, sourceChild){
				if(!(('_' + i) in self)){
					var child = self.get(i);
					if(child != sourceChild){
						self.resettable(child.to(sourceChild));
					}
				}
			});
			return this;
		},
		own: createOwnFunc(),
		resettable: createOwnFunc("reset"),
		reset: function(){},
		destroy: function(){
			this.reset();
			this.cancel();
			this.destroyed = true;
		},
		isCanceled: function(){
			return this.observable && this.observable.isCanceled() || this.cancelled;
		},
		resolve: function(value){
			this.is(value);
		},
		reject: function(e){
			this.observable && this.observable.reject(e);
		},
		cancel: function(){
			this.observable && this.observable.cancel();
			this.cancelled = true;
		}
	};

	function ObjectBinding(){
		Binding.apply(this, arguments);
	}
	ObjectBinding.prototype = new Binding();
	ObjectBinding.prototype.create = function(object){
		this.object = object;
		if(object){
			object._binding = this;
			this.own({
				remove: function(){
					(object || {})._binding = null;
				}
			}, object);
		}
		Binding.prototype.create.call(this);
	};
	ObjectBinding.prototype.get = function(key){
		// use an existing child/property if it exists
		this['_' + key] || (this['_' + key] = this.own(new PropertyBinding(this.object, key))[0]);
		return Binding.prototype.get.apply(this, arguments);
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

	function PropertyBinding(){
		Binding.apply(this, arguments);
	}
	PropertyBinding.prototype = new Binding();
	PropertyBinding.prototype.create = function(object, name){
		this.object = object;
		this.name = name;
		Binding.prototype.create.call(this);
	};
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

	function ViewModelBinding(){
		ObjectBinding.apply(this, arguments);
	}
	ViewModelBinding.prototype = new ObjectBinding();
	ViewModelBinding.prototype.create = function(){
		ObjectBinding.prototype.create.apply(this, arguments);
		if(arguments.length > 0){
			var object = this.object,
				self = this;
			this.keys(function(i, child){
				var prop = object[i];
				self[i] || (self[i] = !isPrimitiveLike(prop) ? prop : child); // Allows consuming components to refer to the original property values directly from this (except for non-object property values)
			});
		}
	};
	ViewModelBinding.prototype.getValue = function(callback){
		callback(undef);
	};
	ViewModelBinding.prototype.setValue = function(value, callback){
		callback && callback(undef);
	};
	ViewModelBinding.prototype.get = function(key){
		// use an existing child/property if it exists
		var object = this.object,
			prop = object[key];
		this['_' + key] || (this['_' + key] = this.own(!isPrimitiveLike(prop) ? convertToBindable(prop) : new PropertyBinding(object, key))[0]);
		return Binding.prototype.get.apply(this, arguments);
	};
	ViewModelBinding.prototype.set = function(key, child){
		this[key] || (this[key] = this.own(!isPrimitiveLike(child) ? child : convertToBindable(child))[0]); // Allows consuming components to refer to the original property values directly from this (except for non-object)
		Binding.prototype.set.apply(this, arguments);
	};

	function ElementBinding(){
		ObjectBinding.apply(this, arguments);
	}
	ElementBinding.prototype = new ObjectBinding();
	ElementBinding.prototype.create = function(){
		ObjectBinding.prototype.create.apply(this, arguments);
		this.element = this.object;
	};
	var checkable = {radio: 1, checkbox: 1};
	ElementBinding.prototype.getValue = function(callback){
		var element = this.element;
		if(isContainer(element)){
			Binding.prototype.getValue.apply(this, arguments);
		}else{
			var value = !("value" in element) ? element.innerText :
				element.type in checkable ? element.checked :
				element.tagName == "SELECT" && this.preservedValue !== undef ? this.preservedValue :
				typeof this.preservedValue == "number" && !isNaN(element.value) ? +element.value :
				element.value;
			callback(value);
		}
	};
	ElementBinding.prototype.setValue = function(value, callback){
		var element = this.element;
		if(isContainer(element)){
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
					self.preservedValue = value;
					if(callback){
						callback(value);
					}
				}
			});
		}
	};
	ElementBinding.prototype.get = function(key){
		var attrib,
			element = this.element;
		this['_' + key] ||
			(this['_' + key] = /^\.collapsed$/i.test(key) ? this.own(new ElementCollapsedBinding(element))[0] :
				/^\.hidden$/i.test(key) ? this.own(new ElementHiddenBinding(element))[0] :
				key.charAt(0) == '.' ? this.own(new ElementClassBinding(element, key.substr(1)))[0] :
				(attrib = (/^\[(.*)\]$/.exec(key) || [])[1]) ? this.own(new ElementAttributeBinding(element, attrib))[0] :
				!isContainer(element) ? this.own(new ElementPropertyBinding(element, key))[0] :
				undef);
		return Binding.prototype.get.apply(this, arguments);
	};
	ElementBinding.prototype.then = function(callback){
		var hc, hcc,
			promise = Binding.prototype.then.call(this, callback),
			element = this.element,
			self = this;
		function onChange(){
			var preservedValue = self.preservedValue;
			self.preservedValue = undef; // Temporary clear the preserved value to obtain the new user input
			self.getValue(function(value){
				self.preservedValue = preservedValue;
				callback(typeof preservedValue == "number" && !isNaN(value) ? +value : value);
			});
		}
		if(!isContainer(element)){
			hc = on(element, "change", onChange);
			if(element.getAttribute("data-continuous")){
				hcc = on(element, "keyup", onChange);
			}
		}
		return this.own({
			remove: function(){
				hcc && hcc.remove();
				hc && hc.remove();
				promise && promise.cancel();
				return hcc = hc = promise = null;
			}
		})[0];
	};
	ElementBinding.prototype.keys = function(){
		Binding.prototype.keys.apply(this, arguments); // Let source provide keys, not generaitng keys from object
	};
	ElementBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var element = this.element,
			self = this;
		if(isContainer(element) && !this.name){ // This function can is used for ElementPropertyBinding, too
			this.parse();
		}else if(isUserChangeable(this)){
			function onChange(){
				if(element.type != "radio" || element.checked){
					var preservedValue = self.preservedValue;
					self.preservedValue = undef; // Temporary clear the preserved value to obtain the new user input
					self.getValue(function(value){
						self.preservedValue = preservedValue;
						source.put(typeof preservedValue == "number" && !isNaN(value) ? +value : value);
					});
				}
			}
			this.resettable(on(element, "change", onChange));
			if(element.getAttribute("data-continuous")){
				this.resettable(on(element, "keyup", onChange));
			}
		}
		return this;
	};
	ElementBinding.prototype.parse = function(){
		var element = this.element,
			source = this.source;
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
		return this;
	};

	function ElementPropertyBinding(){
		PropertyBinding.apply(this, arguments);
	}
	ElementPropertyBinding.prototype = new PropertyBinding();
	ElementPropertyBinding.prototype.create = function(){
		PropertyBinding.prototype.create.apply(this, arguments);
		this.element = this.object;
	};
	ElementPropertyBinding.prototype.then = ElementBinding.prototype.then;
	ElementPropertyBinding.prototype.to = ElementBinding.prototype.to;

	function ElementCollapsedBinding(){
		Binding.apply(this, arguments);
	}
	ElementCollapsedBinding.prototype = new Binding();
	ElementCollapsedBinding.prototype.create = function(element){
		this.element = element;
		Binding.prototype.create.call(this);
	};
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

	function ElementHiddenBinding(){
		Binding.apply(this, arguments);
	}
	ElementHiddenBinding.prototype = new Binding();
	ElementHiddenBinding.prototype.create = function(element){
		this.element = element;
		Binding.prototype.create.call(this);
	};
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
		ElementPropertyBinding.apply(this, arguments);
	}
	ElementAttributeBinding.prototype = new ElementPropertyBinding();
	ElementAttributeBinding.prototype.getValue = function(callback){
		callback(this.object.getAttribute(this.name));
	};
	ElementAttributeBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue !== value){
				value == null ? self.object.removeAttribute(self.name) : self.object.setAttribute(self.name, value);
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
	ArrayBinding.prototype.then = function(callback, errback){
		var observable = this.observable;
		if(!observable){
			var currentValues = [],
				updates = 0,
				length = this.object.length,
				signaler = Observable.makeSignaler(observable = this.observable = new Observable());
			// watch all the items, and return a resulting array whenever an item is updated
			for(var i = 0; i < length; i++){
				(function(i, source){
					Observable.when(source, function(value){
						currentValues[i] = value;
						updates++;
						if(updates >= length){
							signaler(currentValues);
						}
					});
				})(i, this.object[i]);
			}
		}
		return this.own(observable.then(callback, errback))[0];
	};

	function FunctionBinding(){
		Binding.apply(this, arguments);
	}
	FunctionBinding.prototype = new Binding();
	FunctionBinding.prototype.create = function(func, reverseFunc){
		this.func = func;
		this.reverseFunc = reverseFunc;
		Binding.prototype.create.call(this);
	};
	FunctionBinding.prototype.get = function(key){
		return this['_' + key] || (this['_' + key] = new Binding());
	};
	FunctionBinding.prototype.put = function(value){
		this.source && this.reverseFunc && this.source.put(this.reverseFunc(value));
		this.is(value);
	};
	FunctionBinding.prototype.keys = function(){};
	FunctionBinding.prototype.to = function(source, property){
		this.reset();
		source = convertToBindable(source);
		if(property){
			source = source.get(property);
		}
		var self = this,
			func = this.func;
		this.source = source;
		this.resettable(source.then(function(value){
			self.is(isArray(value) ? func.apply(self, value) : func(value));
		}));
		return this;
	};

	function destroy(element){
		for(var list = [element].concat([].slice.call(element.getElementsByTagName("*"), 0)), i = 0, l = list.length; i < l; ++i){
			if(list[i]._binding){
				list[i]._binding.destroy();
			}
		}
	}

	function defaultConverter(object){
		return object != null ?
			object._binding ||
				(object.then ?
					object :
					object.nodeType ?
						new ElementBinding(object) :
						isFunction(object) ?
							new FunctionBinding(object) :
							isArray(object) ?
								new ArrayBinding(object) :
								typeof object == "object" ?
									new ViewModelBinding(object) :
									new Binding(object)) :
			new Binding(object);
	}

	var converters = [defaultConverter];
	function register(converter){
		converters.unshift(converter);
	}
	function convertToBindable(object){
		for(var list = converters.slice(0), converter, binding; converter = list.shift();){
			if(binding = converter(object)){
				return binding;
			}
		}
	}

	function bind(to){
		// first convert target object to the bindable interface
		to = convertToBindable(to);

		for(var i = 1; i < arguments.length; i++){
			var arg = arguments[i];
			if(!isPrimitiveLike(arg)){
				arg = convertToBindable(arguments[i]);
				to.to(arg);
			}else{
				to = to.get(arg);
			}
		}
		return to;
	}

	bind.isPrimitiveLike = isPrimitiveLike;
	bind.isContainer = isContainer;
	bind.createOwnFunc = createOwnFunc;
	bind.destroy = destroy;
	bind.register = register;
	bind.Object = ObjectBinding;
	bind.Property = PropertyBinding;
	bind.Element = ElementBinding;
	bind.ElementCollapsed = ElementCollapsedBinding;
	bind.ElementHidden = ElementHiddenBinding;
	bind.ElementClass = ElementClassBinding;
	bind.ElementAttribute = ElementAttributeBinding;
	bind.Function = FunctionBinding;
	bind.Binding = Binding;
	bind.container = "container";

	return bind;
});
