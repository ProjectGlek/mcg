extends Node

@export var mob_scene: PackedScene
var score

func _ready() -> void:
	#new_game()
	pass

func _process(delta: float) -> void:
	pass


func _on_player_hit() -> void:
	#$ScoreTimer.stop()
	#$MobTimer.stop()
	pass
	
func new_game():
	score = 0
	#$Player.start($StartPosition.position)
	$StartTimer.start()
	$HUD.update_score(score)
	$HUD.show_message("Get Ready")
	$Music.play()
	await get_tree().create_timer(10).timeout
	
	game_over()

func game_over():
	$ScoreTimer.stop()
	$MobTimer.stop()
	$HUD.show_game_over()
	$Music.stop()
	$GameOver.play()
	#get_tree().call_group("Enemies", "free")?????поч не пропали дауны

func _on_mob_timer_timeout() -> void:

	var mob = mob_scene.instantiate()
	var mob_spawn_location = $MobPath/MobSpawnLocation
	mob_spawn_location.progress_ratio = randf()

	mob.position = mob_spawn_location.position

	var velocity = Vector2(randf_range(150.0, 250.0), 0.0)
	mob.linear_velocity = velocity

	add_child(mob)


func _on_score_timer_timeout() -> void:
	score += 1
	$HUD.update_score(score)


func _on_start_timer_timeout() -> void:
	$MobTimer.start()
	$ScoreTimer.start()
