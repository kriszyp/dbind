define([], function(){
	// A basic binding to value, our base class
	function Binding(value){
		this.value= value;
		if(value){
			value._binding = this;
		}
	}
	Binding.prototype = {
		receive: function(callback){
			// get the value of this binding, by notifying the callback of initial value and any
			// future changes.
			// this function is responsible for tracking all the callbacks, and notifying all of
			// these for any changes. This function relies on getValue to retrieve the current
			// value and future values. This function will only call getValue one time, so getValue
			// does not need to track multiple callbacks. In creating new Binding implementations, one
			// can implement the getValue function instead of receive, to simplify the implementation.
			var callbacks= this.callbacks;
			(callbacks || (this.callbacks = [])).push(callback);
			if(callbacks){
				// we have already run once for this binding, so we are already listening to getValue
				// we can just add to the list callbacks, and notify the new callback of the user
				// current value (if it exists)
				if("value" in this){
					callback(this.value);
				}
			}else{
				var self = this;
				callbacks = this.callbacks;
				this.getValue(function(value){
					// for each change, call all the callbacks
					self.value = value;
					for(var i = 0; i < callbacks.length; i++){
						callbacks[i](value);
					}
				});
			}

			return {
				remove: function(){
					for(var i = 0; i < callbacks.length; ++i){
						if(callback === callbacks[i]){
							callbacks.splice(i, 1);
							break;
						}
					}
				}
			};
		},
		getValue: function(callback){
			// this method can be implemented to provide the current and future values
			// of this binding. This should only be called by receive, it shouldn't be called directly.
			// It should also only be called once by receive() for a binding, so this function
			// shouldn't need to implement any caching or tracking of callbacks, other than
			// one that is provided.
			if(this.hasOwnProperty("value")){
				callback(this.value);
			}
		},
		get: function(key, callback){
			// This returns the property by the given key, as a binding. If the optional second
			// argument is included it will be registered as the callback to receive updates from
			// the property's binding.

			// use an existing child/property if it exists
			var value, child = this['_' + key] || 
				(this['_' + key] = this.hasOwnProperty("value") && this.value && typeof this.value == "object" ?
					new PropertyBinding(this.value, key) :
						new Binding());
			if(callback){
				return child.receive(callback);
			}
			return child;
		},
		put: function(value){
			// A request to update the value of the binding. Note this differs from the is()
			// method in that put() is a request to make a change (which could be rejected), whereas is()
			// is used to reflect a change that has already taken place
			if(this.source){
				this.source.put(value);
			}
			value._binding = this;
			this.is(value);
		},
		set: function(name, value){
			// Sets the value of the named property. This is equivalent to this.get(name).put(value). 
			this.get(name).put(value);
		},
		is: function(value){
			// Notify this binding of a change to its value. This is used when this binding
			// is being notified as part of its responsibility to stay in sync with source data.
			// All listeners to this binding will be notified of this change. This is generally only
			// called internally or by code responsible for the synchronization of this binding.
			if(value !== this.value){
				this.value = value;
				if(typeof this.value == "object"){
					// if we get an object, we need to notify all the property bindings as well
					for(var i in value){
						if(i.charAt(0) != '_'){
							var property = this.get(i);
							property.object = value;
							property.is(value[i]);
						}
					}
				}
				// notify the callbacks of the change
				if(this.callbacks){
					for(var i = 0; i < this.callbacks.length; i++){
						this.callbacks[i](value);
					}
				}
			}
		},
		keys: function(callback){
			// this provides notification of all the present and future property names
			if(this.source){
				this.source.keys(callback);
			}
			for(var i in this.value){
				if(i.charAt(0) != '_'){
					callback(i, this.get(i));
				}
			}
		},
		to: function(source, property){
			// Connect this binding to another binding, such that any changes in the source
			// binding are reflected in this binding, and vice versa, keeping the bindings in sync.
			source = convertToBindable(source);
			if(property){
				source = source.get(property);
			}
			var self = this;
			this.source = source;
			source.receive(function(value){
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
	// StatefulBinding is used for binding to Stateful objects, particularly Dijit widgets.
	// This adapts Stateful objects to dbind bindings.
	function StatefulBinding(stateful){
		this.stateful = stateful;
		stateful._binding = this;
	}
	StatefulBinding.prototype = new Binding({}); 
	StatefulBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var stateful = this.stateful;
		// we can bind to another binding, and synchronize changes
		source.receive(function(value){
			stateful.set('value', value);
		});
		stateful.watch('value', function(property, oldValue, value){
			if(oldValue !== value){
				source.put(value);
			}
		});
		return this;
	};
	StatefulBinding.prototype.get = function(key, callback){
		return this['_' + key] || (this['_' + key] = new StatefulPropertyBinding(this.stateful, key));
	};
	StatefulBinding.prototype.keys = function(callback){
		for(var i in this.stateful){
			if(i.charAt(0) != '_'){
				callback(i, this.get(i));
			}
		}
	};
	// This constructor provides property bindings for the stateful bindings.
	function StatefulPropertyBinding(stateful, name){
		this.stateful = stateful;
		this.name = name;
	}
	StatefulPropertyBinding.prototype = new Binding;
	StatefulPropertyBinding.prototype.getValue = function(callback){
		// get the value of this property
		var stateful = this.stateful,
			name = this.name;
		// get the current value
		callback(stateful.get(name));
		// watch for changes
		stateful.watch(name, function(name, oldValue, newValue){
			if(oldValue !== newValue){
				callback(newValue);
			}
		});
	};
	StatefulPropertyBinding.prototype.is = function(value){
		// don't go through setters, it is bubbling up through the source
		this.stateful._changeAttrValue(this.name, value);
		//return Binding.prototype.is.call(this, value);
	}
	StatefulPropertyBinding.prototype.put = function(value){
		// put a value, go through setter
		this.stateful.set(this.name, value);
	}
	// This provides a binding to DOM elements, either binding to input values or the text
	// content of non-input elements
	function ElementBinding(element, container){
		this.element= element;
		this.container = container;
		element._binding = this;
	}
	function ContainerBinding(element){
		return new ElementBinding(element, true);
	}
	ElementBinding.prototype = new Binding({});
	var checkable = {radio: 1, checkbox: 1};
	ElementBinding.prototype.is = function(value){
		var element = this.element;
		if(this.container || element.tagName == "FORM"){
			return Binding.prototype.is.call(this, value);
		};
		if("value" in element){
			if(element.type == "radio"){
				element.checked = element.value == value;
			}else if(element.type == "checkbox"){
				element.checked = value;
			}else{
				element.value = value || "";
			}
		}else if(element.nodeType == 3){
			element.nodeValue = value || "";
		}else{
			element.innerText = value || "";
		}
		this.oldValue = value;
	};
	var inputLike = {
		"INPUT":1,
		"SELECT":1,
		"TEXTAREA":1
	};
	ElementBinding.prototype.to = function(source){
		Binding.prototype.to.apply(this, arguments);
		source = this.source;
		var element = this.element;
		if(element.tagName == "FORM"){
			// if we have a form, bind the inputs to the properties of the source binding
			var binding = this;
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
			// of input elements, bind the value to the source binding, put()'ing any changes
			// detected from the user, and updating the input in response to changes in 
			// the source binding. 
			var value, binding = this,
				onchange = element.onchange = function(){
				if(element.type == "radio"){
					if(element.checked){
						value = element.value;
					}else{
						return; // not checked, don't do anything
					}
				}else{
					value = element.type == "checkbox" ? element.checked : element.value;
				}
				source.put(typeof binding.oldValue == "number" && !isNaN(value) ? +value : value);
			};
			if(element.getAttribute('data-continuous')){
				element.onkeyup = onchange;
			}
		}
		return this;
	}
	ElementBinding.prototype.receive = function(callback){
		// receive changes by listening for input changes
		var element = this.element;
		if(this.container){
			return Binding.prototype.receive.call(this, callback);
		}
		if("value" in element){
			callback(element.value);
			element.onchange = function(){
				callback(element.value);
			};
		}else if(element.nodeType == 3){
			callback(element.nodeValue);
		}else{
			callback(element.innerText);
		}
	};
	//
	function ArrayBinding(){
		Binding.apply(this, arguments);
	}
	ArrayBinding.prototype = new Binding({});
	ArrayBinding.prototype.getValue = function(callback){
		var currentValues = [],
			updates = 0,
			length = this.value.length;
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
			})(i, this.value[i]);
		}
	}
	// This binding is responsible for tracking changes in properties of objects
	function PropertyBinding(object, name){
		this.object = object;
		this.name = name;
	}
	PropertyBinding.prototype = new Binding;
	PropertyBinding.prototype.getValue = function(callback){
		callback(this.object[this.name]);
	};
	PropertyBinding.prototype.put = function(value){
		this.object[this.name] = value;
		this.is(value);
	}
	// A function binding can take a provided function and output the result of the execution
	// of the function every time the source data changes, allowing the function to act
	// as a reactive function 
	function FunctionBinding(func, reverseFunc){
		this.func = func;
		this.reverseFunc = reverseFunc;
	}
	FunctionBinding.prototype = {
		receive: function(callback){
			if(callback){
				var func = this.func;
				return this.source.receive(function(value){
					callback(value != null && value.join ? func.apply(this, value) : func(value));
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
			source = bind.apply(this, arguments);
			this.source = source;
			return this;
		},
		keys: function(){}
	}
	// Given a particular value, automatically determine the most appropriate binding
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
							object instanceof Array ?
								new ArrayBinding(object) :
				 				new Binding(object))
			: new Binding(object);
	}
	// convenience functions for binding and get()'ing 
	function bind(to){
		// first convert target object to the bindable interface
		to = convertToBindable(to);
	
		for(var i = 1; i < arguments.length; i++){
			var arg = arguments[i];
			if(typeof arg == "object" || typeof arg == "function"){
				arg = convertToBindable(arguments[i]);
				to.to(arg);
			}else{
				to = to.get(arg);
			}
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


	function when(value, callback){
		if(value && value.receive){
			return value.receive(callback);
		}
		return callback(value);
	}
	bind.when = when;

	return bind;
});
