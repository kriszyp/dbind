define(function(){
	var undef,
		freeze,
		RESOLVED = 1,
		REJECTED = 2,
		methods = [undef, "resolve", "reject"];

	function empty(){}
	freeze = Object.freeze || empty;

	function CancelError(message){
		var e = new Error(message);
		e.dojoType = "cancel";
		return e;
	}

	function makeObservableSignaler(observable, type){
		return function(result){
			if(observable && !observable.isCanceled()){
				observable[methods[type !== undef ? type : result instanceof Error ? REJECTED : RESOLVED]](result);
			}
		};
	}

	function signalListeners(listeners, type, result){
		listeners = listeners.slice();
		for(var listener; listener = listeners.shift();){
			var func = listener[type],
				observable = listener.observable;
			if(func){
				try{
					var newResult = func(result);
					if(newResult && typeof newResult.then === "function"){
						newResult.then(makeObservableSignaler(observable, RESOLVED), makeObservableSignaler(observable, REJECTED));
					}else{
						makeObservableSignaler(observable, RESOLVED)(newResult === undef ? result : newResult);
					}
				}catch(error){
					makeObservableSignaler(observable, REJECTED)(error);
				}
			}else{
				makeObservableSignaler(observable, type)(result);
			}
		}
	}

	// Mutable version of Promises/A
	// Major differences from original Promises/A are:
	//		- resolve()/reject() can be called multiple times, and listener callbacks are called every time that happens
	//		- Allows to remove indivisual callback set (As instances may persist throughout the entire application lifecycle)
	//		- No progress callback support
	function Observable(canceler){
		var last,
			result,
			canceled,
			observable = this,
			view = {},
			listeners = [];
		this.isCanceled = view.isCanceled = function(){
			return canceled;
		};
		this.resolve = function(value){
			signalListeners(listeners, last = RESOLVED, result = value);
			return view;
		};
		this.reject = function(error){
			signalListeners(listeners, last = REJECTED, result = error);
			return view;
		};
		this.then = view.then = function(callback, errback){
			var listener = [undef, callback, errback];
			listener.observable = new Observable(function(){
				for(var i = listeners.length - 1; i >= 0; --i){
					if(listeners[i] == listener){
						listeners.splice(i, 1);
					}
				}
			});
			listeners.push(listener);
			if(last !== undef){
				signalListeners([listener], last, result);
			}
			return listener.observable.view;
		};
		this.cancel = view.cancel = function(){
			var error = canceler && canceler(observable);
			(error = error instanceof Error ? error : new CancelError(error)).log = false;
			observable.reject(error);
			canceled = true;
		};
		freeze(this.view = view);
	}

	Observable.makeSignaler = makeObservableSignaler;

	function when(value, callback){
		if(value && value.then){
			return value.then(callback);
		}
		return callback(value);
	}
	Observable.when = when;

	return Observable;
});