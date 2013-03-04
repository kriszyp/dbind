define([
	"./Observable",
	"./bind"
], function(Observable, bind){
	var undef,
		Binding = bind.Binding,
		ObjectBinding = bind.Object,
		PropertyBinding = bind.Property;

	function StatefulBinding(){
		ObjectBinding.apply(this, arguments);
	}
	StatefulBinding.prototype = new ObjectBinding();
	StatefulBinding.prototype.get = function(key){
		this['_' + key] || (this['_' + key] = this.own(new StatefulPropertyBinding(this.object, key))[0]);
		return Binding.prototype.get.apply(this, arguments);
	};

	function StatefulPropertyBinding(){
		PropertyBinding.apply(this, arguments);
	}
	StatefulPropertyBinding.prototype = new PropertyBinding();
	StatefulPropertyBinding.prototype.then = function(callback, errback){
		var observable = this.observable;
		if(!observable){
			var signaler = Observable.makeSignaler(observable = this.observable = new Observable());
			this.getValue(signaler);
			this.own(this.object.watch(this.name, function(name, old, current){
				if(old !== current){
					signaler(current);
				}
			}));
		}
		return this.own(observable.then(callback, errback))[0];
	};
	StatefulPropertyBinding.prototype.getValue = function(callback){
		callback(this.object.get(this.name));
	};
	StatefulPropertyBinding.prototype.setValue = function(value, callback){
		var self = this;
		this.getValue(function(oldValue){
			if(oldValue !== value){
				self.object.set(self.name, value); // Sets Stateful, and a watch callback runs observable signaler
				if(callback){
					callback(value);
				}
			}
		});
	};
	StatefulPropertyBinding.prototype.is = function(value){
		this.setValue(value); // setValue() here updates the stateful, and a watch callback runs observable signaler
	};
	StatefulPropertyBinding.prototype.to = function(){
		PropertyBinding.prototype.to.apply(this, arguments);
		var source = this.source;
		this.resettable(this.object.watch(this.name, function(name, old, current){
			if(old !== current){
				source.put(current);
			}
		}));
		return this;
	};

	bind.register(function(object){
		return object && !object._binding && object.get && !object.is && new StatefulBinding(object);
	});

	bind.Stateful = StatefulBinding;
	bind.StatefulProperty = StatefulPropertyBinding;
	return bind;
});
